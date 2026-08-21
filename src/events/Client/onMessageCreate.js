const {
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	AttachmentBuilder,
} = require('discord.js');
const Event = require('../../structure/Event');
const { buildJobInvoice } = require('../../utils/generateManifest');

// --- Services ---
const { validateAndFetchJob } = require('../../services/JobProcessor/JobValidator');
const { calculateExpenses, formatOffenceName } = require('../../services/JobProcessor/ExpenseCalculator');
const { calculateRewards } = require('../../services/JobProcessor/RewardCalculator');
const { calculatePenaltyAndXp, formatStatsType } = require('../../services/JobProcessor/PenaltyAndXpCalculator');
const { updateDatabase } = require('../../services/JobProcessor/DatabaseUpdater');

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			if (message.author.bot) return;

			// --- Natasya AI Service (Mention / DM) ---
			// Check if message is in DM (ChannelType.DM is 1) or if bot is mentioned
			if (message.channel.type === 1 || message.mentions.has(__client__.user)) {
				const { handleChat } = require('../../services/aiService');
				return handleChat(message);
			}

			// 1. Validasi, Fetch Data, & Get DB Lock
			let context = await validateAndFetchJob(__client__, message);
			if (!context) return;

			// 2. Kalkulasi Pengeluaran (Rent, Service, Fuel, Fines)
			context = await calculateExpenses(context, __client__);

			// 3. Kalkulasi Pemasukan (Base NC, Event, Booster, Nismara Plus)
			context = await calculateRewards(context, __client__, message);

			// 4. Kalkulasi Penalty Poin & XP Driver
			context = await calculatePenaltyAndXp(context, __client__);

			// 5. Simpan Hasil ke Database
			context = await updateDatabase(context, __client__);

			// ==========================================================
			// 6. DISCORD MESSAGING & EMBEDS
			// ==========================================================
			const {
				job, jobId, discordId, gameName, settings,
				rewardTotal, totalCurrency, penalty, reward, cost, discount,
				maintenancePenaltyAmount, truckyName, isSpecialContract,
				driver, currentPenaltyPoints, totalPointsBefore
			} = context;

			// --- EMBED REPORT NC MANAGER ---
			if (settings.channelLog) {
				const logChannel = message.guild.channels.cache.get(settings.channelLog);
				if (logChannel) {
					const ncField = [];
					if (reward.base > 0) ncField.push({ name: '🪙 Base NC Earned', value: `+${reward.base} N¢`, inline: true });
					if (reward.special > 0) ncField.push({ name: '⭐ Special Contract NC Earned', value: `+${reward.special} N¢`, inline: true });
					if (reward.hardcore > 0) ncField.push({ name: '🔥 Hardcore Bonus Earned', value: `+${reward.hardcore} N¢`, inline: true });
					if (reward.event > 0) ncField.push({ name: '🎉 Event NC Boost Earned', value: `+${reward.event} N¢`, inline: true });
					if (reward.booster > 0) ncField.push({ name: '💎 Server Booster Bonus Earned', value: `+${reward.booster} N¢`, inline: true });
					if (reward.nismaraplus > 0) ncField.push({ name: '💜 Nismara Plus Bonus Earned', value: `+${reward.nismaraplus} N¢`, inline: true });
					if (maintenancePenaltyAmount > 0) ncField.push({ name: '🔧 Maintenance Penalty', value: `-${maintenancePenaltyAmount} N¢`, inline: false });
					if (discount.insurance > 0) ncField.push({ name: '🛡️ Insurance Discount', value: `-${discount.insurance} N¢`, inline: false });
					if (discount.nismaraplus > 0) ncField.push({ name: '💜 Nismara Plus Discount', value: `-${discount.nismaraplus} N¢`, inline: true });
					if (discount.total > 0) ncField.push({ name: '💰 Total Discount', value: `-${discount.total} N¢`, inline: true });
					if (cost.rent > 0) ncField.push({ name: '🚗 Vehicle Rental Cost', value: `-${cost.rent} N¢`, inline: false });
					if (cost.service > 0) ncField.push({ name: '🔧 Vehicle Service Cost', value: `-${cost.service} N¢`, inline: true });
					if (cost.fuel > 0) ncField.push({ name: '⛽ Fuel Cost', value: `-${cost.fuel} N¢`, inline: true });
					if (cost.fines > 0) ncField.push({ name: '⛔ Traffic Fines Cost', value: `-${cost.fines} N¢`, inline: true });
					if (cost.total > 0) ncField.push({ name: '💰 Total Cost', value: `-${cost.total} N¢`, inline: true });

					const embedLogNC = new EmbedBuilder()
						.setTitle(`🪙 | NC Reward Report - Job #${jobId}`)
						.setColor('Blue')
						.setDescription(`Driver: <@${discordId}>\nTotal NC Earned: **${reward.total} N¢**\nTotal Cost: **${cost.total} N¢**\nFinal NC: **${rewardTotal} N¢**`)
						.addFields(ncField)
						.setTimestamp()
						.setURL(job.public_url)
						.setThumbnail(job.driver.avatar_url || message.guild.iconURL({ forceStatic: false }));
					
					logChannel.send({ embeds: [embedLogNC] });
				}
			}

			// --- USER REPORT EMBED ---
			const fields = [];
			if (penalty.total > 0) {
				fields.push({ name: '⚖️ Penalty Rule Set', value: context.driverJob?.gameMode === 'truckersmp' ? 'TruckersMP Damage Rule' : 'Standard Damage Rule' });
			}
			if (gameName) fields.push({ name: '🌐 Game', value: gameName });
			if (reward.base > 0) fields.push({ name: '🪙 Base NC Earned', value: `+${reward.base} N¢`, inline: true });
			if (reward.hardcore > 0) fields.push({ name: '🔥 Hardcore Bonus Earned', value: `+${reward.hardcore} N¢`, inline: true });
			if (reward.event > 0) fields.push({ name: '🎉 Event N¢ Boost Earned', value: `+${reward.event} N¢`, inline: true });
			if (reward.booster > 0) fields.push({ name: '💎 Server Booster Bonus Earned', value: `+${reward.booster} N¢`, inline: true });
			if (reward.nismaraplus > 0) fields.push({ name: '💜 Nismara Plus Bonus Earned', value: `+${reward.nismaraplus} N¢`, inline: true });
			if (reward.total > 0) fields.push({ name: '🪙 Total NC Earned', value: `+${reward.total} N¢`, inline: true });
			if (cost.rent > 0) fields.push({ name: '🚗 Vehicle Rental Cost', value: `-${cost.rent} N¢`, inline: true });
			if (cost.service > 0) fields.push({ name: '🔧 Vehicle Service Cost', value: `-${cost.service} N¢`, inline: true });
			if (cost.fuel > 0) fields.push({ name: '⛽ Fuel Cost', value: `-${cost.fuel} N¢`, inline: true });
			if (cost.fines > 0) fields.push({ name: '👮 Traffic Fines', value: `-${cost.fines} N¢`, inline: true });
			if (cost.total > 0) fields.push({ name: '💰 Total Cost', value: `-${cost.total} N¢`, inline: true });
			if (maintenancePenaltyAmount > 0) fields.push({ name: '🔧 Vehicle Maintenance Penalty', value: `-${maintenancePenaltyAmount} N¢`, inline: false });
			if (penalty.vehicle > 0) fields.push({ name: '🚗 Vehicle Damage', value: `${job.vehicle_damage}% → **${penalty.vehicle}** points`, inline: false });
			if (penalty.trailer > 0) fields.push({ name: '🚛 Trailer Damage', value: `${job.trailers_damage}% → **${penalty.trailer}** points`, inline: true });
			if (penalty.cargo > 0) fields.push({ name: '📦 Cargo Damage', value: `${job.cargo_damage}% → **${penalty.cargo}** points`, inline: true });
			if (penalty.distance > 0) fields.push({ name: '🛣️ Distance Penalty', value: `${job.driven_distance_km} Km → **${penalty.distance}** points`, inline: true });
			if (penalty.speed > 0) fields.push({ name: '⚡ Speed Penalty', value: `${formatStatsType(job.stats_type)} → **${penalty.speed}** points`, inline: true });

			let description;
			if (penalty.total > 0) {
				description = `Terimakasih telah menyelesaikan job #${jobId} di ${gameName}!\nPekerjaan kamu dikategorikan sebagai ${isSpecialContract ? 'Special Contract Job' : 'Standard Job'}.\n\nKamu mendapatkan total penghasilan 🪙 **${rewardTotal} N¢**\nSaldo NC kamu sekarang adalah **${totalCurrency} N¢**.\n⚠️ Namun, terdapat beberapa pelanggaran selama job berlangsung.\nDan kamu menerima **${penalty.total} penalty points** dari job ini.\nSebagai pengingat, total point penalty kamu saat ini adalah **${currentPenaltyPoints} points**.`;
			} else {
				description = `Terimakasih telah menyelesaikan job **#${jobId}** di ${gameName}!\nPekerjaan kamu dikategorikan sebagai ${isSpecialContract ? 'Special Contract Job' : 'Standard Job'}.\n\nKamu mendapatkan total penghasilan 🪙 **${rewardTotal} N¢**\nSaldo NC kamu sekarang adalah **${totalCurrency} N¢**.\n🎉 Kamu tidak menerima penalty apapun dari job ini!`;
			}

			if (maintenancePenaltyAmount > 0) {
				description += `\n\n🚨 **PERINGATAN:** Kamu dikenakan penalti pemotongan pendapatan sebesar **50% (-${maintenancePenaltyAmount} N¢)** karena menggunakan kendaraan armada yang belum diservis (\`need_maintenance\` / \`onservice\`)!`;
			}

			const embedUser = new EmbedBuilder()
				.setTitle(`💼 | Laporan Pekerjaan Selesai - Job #${jobId}`)
				.setURL(`${process.env.WEB_URL}/jobs/${jobId}`)
				.setColor(penalty.total > 0 ? 'Red' : 'Green')
				.setDescription(description)
				.setFooter({ text: 'Untuk informasi lebih detail kamu bisa download Manifest Job yang sudah dikirim di atas' })
				.setTimestamp()
				.setThumbnail(message.guild.iconURL({ forceStatic: false }));

			if (fields.length > 0) embedUser.addFields(fields);

			// --- PDF MANIFEST GENERATION ---
			const companyLogoUrl = job.company?.avatar ? `https://cdn.truckyapp.com/${job.company.avatar}` : null;
			const pdfBuffer = await buildJobInvoice(job, reward, cost, discount, rewardTotal, totalCurrency, truckyName, companyLogoUrl, penalty);
			const pdfAttachment = new AttachmentBuilder(pdfBuffer, { name: `Manifest-Job-${jobId}-${job.driver.name}.pdf` });

			__client__.users.send(discordId, { embeds: [embedUser], files: [pdfAttachment] }).catch(() => {});

			// --- SPECIAL CONTRACT EMBEDS ---
			if (isSpecialContract) {
				const notifyChannel = message.guild.channels.cache.get(settings.contractChannel);
				if (notifyChannel) {
					const actualEndAt = Math.floor(new Date(job.completed_at).getTime() / 1000);
					const readableStats = job.stats_type === 'race_miles' ? 'Race Miles' : (job.stats_type === 'real_miles' ? 'Real Miles' : 'Unknown');
					
					const fieldPage1 = [
						{ name: '🌐 World', value: gameName },
						{ name: '🏢 Asal', value: job.source_company_name, inline: true },
						{ name: '🏭 Tujuan', value: job.destination_company_name, inline: true },
						{ name: '🚚 Rute', value: `${job.source_city_name} → ${job.destination_city_name} (${job.driven_distance_km} km)` },
						{ name: '📦 Kargo', value: `${job.cargo_name} (${job.cargo_mass_t}t)`, inline: true },
						{ name: '⏱️ Durasi', value: job.duration, inline: true },
						{ name: '💰 Nismara Coin Didapat', value: `${reward.total} N¢` },
						{ name: '📊 Tipe Statistik', value: formatStatsType(job.stats_type) || readableStats, inline: true },
						{ name: '🗓️ Waktu Selesai', value: `<t:${actualEndAt}:F>` }
					];
					if (job.delivery_rating) fieldPage1.push({ name: '⭐ Rating Pengiriman', value: `${job.delivery_rating}/5`, inline: true });
					if (job.realistic_ldb_points) fieldPage1.push({ name: '🏆 Hardcore Points', value: `${job.realistic_ldb_points} points`, inline: true });

					const page1 = new EmbedBuilder().setTitle(`📦 Special Contract Completed! - #${jobId}`).setColor('Green').setAuthor({ name: job.driver.name, iconURL: job.driver.avatar_url }).addFields(fieldPage1).setThumbnail(job.driver.avatar_url).setURL(job.public_url).setTimestamp().setFooter({ text: 'Halaman 1 • Ringkasan Job' });

					const page2 = new EmbedBuilder().setTitle('💰 Laporan Keuangan & Statistik Ekonomi').setColor('Gold');
					let finesArr = [];
					if (job.fines_details && typeof job.fines_details === 'string' && job.fines_details.length > 2) {
						try { finesArr = JSON.parse(job.fines_details); } catch (e) { }
					}
					const finesTotalFromList = Array.isArray(finesArr) && finesArr.length > 0 ? finesArr.reduce((s, f) => s + (f.amount || 0), 0) : 0;
					const otherCosts = Number(job.other_costs_total || 0);
					const damageCost = Number(job.damage_cost || 0);
					const taxes = Number(job.taxes || 0);
					const rentCost = Number(job.rent_cost_total || 0);
					const netProfit = Number(job.income || 0) - (taxes + rentCost + otherCosts + damageCost + finesTotalFromList);

					let economyReport = [
						`🏦 Pendapatan Kotor  : ${Number(job.income || 0).toLocaleString()} T¢`,
						`💵 Pendapatan Bersih : ${Number(job.revenue || 0).toLocaleString()} T¢`,
						`💸 Pajak             : ${taxes.toLocaleString()} T¢`,
						`🧾 Biaya Sewa        : ${rentCost.toLocaleString()} T¢`,
						`⛽ Bahan Bakar       : ${Number(job.fuel_used_l || 0).toFixed(1)} L (${Number(job.fuel_cost || 0).toFixed(2)} T¢)`,
						`⚙️ Efisiensi BBM     : ${job.fuel_economy_l100km ?? '-'} L/100km`
					];
					if (otherCosts > 0) economyReport.push('', `💼 Biaya Lain-lain   : ${otherCosts.toFixed(2)} T¢`);
					if (damageCost > 0) {
						let dmgDetails = {};
						try { dmgDetails = JSON.parse(job.damage_cost_details || '{}'); } catch(e){}
						economyReport.push('', `💥 Biaya Kerusakan   : ${damageCost.toFixed(2)} T¢`, `  🚛 Truk    : ${dmgDetails.vehicle_damage ?? 0}T¢`, `  🛞 Trailer : ${dmgDetails.trailers_damage ?? 0}T¢`, `  📦 Kargo   : ${dmgDetails.cargo_damage ?? 0}T¢`);
					}
					if (finesArr.length > 0) {
						economyReport.push('', '🚨 Denda :');
						finesArr.slice(0, 8).forEach(f => economyReport.push(`• ${formatOffenceName(f.offence)} — ${Number(f.amount || 0).toLocaleString()} T¢`));
						if (finesArr.length > 8) economyReport.push(`(+${finesArr.length - 8} denda lainnya)`);
					}
					economyReport.push('', `🧾 Net Profit (est)  : ${netProfit.toLocaleString()} T¢`);
					page2.setDescription('```yaml\n' + economyReport.join('\n') + '\n```').setTimestamp().setFooter({ text: 'Halaman 2 • Laporan Keuangan & Statistik Ekonomi' });

					const page3 = new EmbedBuilder().setTitle('⚙️ Damage & Performa Kendaraan').setColor('Red').addFields(
						{ name: '🚛 Kerusakan Truk', value: `${job.vehicle_damage}%`, inline: true },
						{ name: '🛞 Kerusakan Trailer', value: `${job.trailers_damage}%`, inline: true },
						{ name: '📦 Kerusakan Kargo', value: `${job.cargo_damage}%`, inline: true },
						{ name: '🚀 Kecepatan Maksimum', value: `${job.max_speed_kmh} km/h`, inline: true },
						{ name: '🧭 Kecepatan Rata-rata', value: `${job.average_speed_kmh} km/h`, inline: true },
						{ name: '⭐ Rating Pengiriman', value: `${job.delivery_rating_details?.rating ?? 0}`, inline: true }
					).setTimestamp().setFooter({ text: 'Halaman 3 • Damage & Performa' });

					let pages = [page1, page2, page3];
					let options = [
						{ label: '📄 Ringkasan Job', value: '0', description: 'Lihat ringkasan umum job' },
						{ label: '💰 Statistik Ekonomi', value: '1', description: 'Pendapatan, pajak, dan bahan bakar' },
						{ label: '⚙️ Damage & Performa', value: '2', description: 'Kerusakan kendaraan dan rating' }
					];

					if (job.realistic_points_calculation || job.realistic_ldb_points) {
						const rp = job.realistic_points_calculation || {};
						const drd = job.delivery_rating_details || {};
						const page4 = new EmbedBuilder().setTitle('🎯 Realistic Points & Driver Rating').setColor('Blue').addFields(
							{ name: '🏁 Total Poin', value: `${job.realistic_ldb_points ?? 0} point`, inline: true },
							{ name: '⭐ Rating Realistis', value: `⭐ ${job.delivery_rating_details?.rating ?? 0}`, inline: true },
							{ name: '📏 Jarak', value: `${rp.distance?.toFixed(1) ?? 0} point`, inline: true },
							{ name: '⚖️ Berat Muatan', value: `⭐ ${drd.massRating ?? 0} → ${rp.mass?.toFixed(1) ?? 0} point`, inline: true },
							{ name: '🚫 Denda', value: `⭐ ${rp.finesRating ?? 0} → ${rp.fines?.toFixed(1) ?? 0} point`, inline: true },
							{ name: '💥 Kerusakan', value: `⭐ ${rp.damageRating ?? 0} → ${rp.damage?.toFixed(1) ?? 0} point`, inline: true },
							{ name: '⛽ Efisiensi BBM', value: `⭐ ${rp.fuelEconomyRating ?? 0} → ${rp.fuel_economy?.toFixed(1) ?? 0} point`, inline: true },
							{ name: '🅿️ Parkir Ganda', value: `${rp.hard_parking_doubles?.toFixed(1) ?? 0} point`, inline: true }
						).setTimestamp().setFooter({ text: 'Halaman 4 • Realistic Points' });
						pages.push(page4);
						options.push({ label: '🎯 Realistic Points', value: '3', description: 'Poin realistis dan performa driver' });
					}

					const menu = new StringSelectMenuBuilder().setCustomId('page_select').setPlaceholder('📑 Pilih halaman untuk dilihat').addOptions(options);
					const row = new ActionRowBuilder().addComponents(menu);

					let currentPage = 0;
					const contractMsg = await notifyChannel.send({
						content: `✅ **${job.driver.name}** telah menyelesaikan Special Contract!`,
						embeds: [pages[currentPage]],
						components: [row],
					});

					const allowedRoles = [...(settings.roles?.manager || []), ...(settings.roles?.moderator || [])];
					const collector = contractMsg.createMessageComponentCollector({ time: 3600000 });
					collector.on('collect', async (i) => {
						const member = await i.guild.members.fetch(i.user.id);
						const hasRole = member.roles.cache.some(role => allowedRoles.includes(role.id));
						if (i.user.id !== driver.userId && !hasRole) {
							return i.reply({ content: '❌ Kamu tidak memiliki izin untuk melihat data job ini.', ephemeral: true });
						}
						currentPage = parseInt(i.values[0]);
						await i.update({ embeds: [pages[currentPage]], components: [row] });
					});
					collector.on('end', async () => {
						menu.setDisabled(true);
						await contractMsg.edit({ components: [new ActionRowBuilder().addComponents(menu)] });
					});
				}
			}
			
			// --- AUTO PENALTY WARNING ---
			const WARNING_THRESHOLD = 50;
			const WARNING_PENALTY_ADD = 20;

			// WARNING THRESHOLD
			if (currentPenaltyPoints >= WARNING_THRESHOLD && totalPointsBefore < WARNING_THRESHOLD) {
				const penaltyEmbed = new EmbedBuilder()
					.setTitle('⚠️ SP1 Peringatan Pelanggaran Driver')
					.setDescription(
						`Hai <@${discordId}>,\nKami mencatat bahwa akumulasi poin penalti kamu telah mencapai **${currentPenaltyPoints} poin**.\nIni adalah SP 1 dari kami,\n\n💡 **Tips:** Mengemudilah lebih berhati hati dan ikuti rambu rambu dan hindari merusak kargo!\n\nHubungi Management bila ada pertanyaan lebih lanjut.`
					)
					.setColor('#FFA500')
					.setTimestamp();
				try {
					const userToDM = await __client__.users.fetch(discordId);
					if (userToDM) await userToDM.send({ embeds: [penaltyEmbed] });
				} catch (err) {}
				const warningChannel = message.guild.channels.cache.get(settings.channelLog);
				if (warningChannel) {
					warningChannel.send({ content: `⚠️ **WARNING SP1:** Driver <@${discordId}> (Trucky ID: ${truckyId}) telah mencapai limit warning poin penalti (${currentPenaltyPoints} points).` });
				}
			} else if (currentPenaltyPoints >= WARNING_THRESHOLD && currentPenaltyPoints >= totalPointsBefore + WARNING_PENALTY_ADD) {
				const penaltyEmbed = new EmbedBuilder()
					.setTitle('🚨 SP Lanjutan Peringatan Pelanggaran Driver')
					.setDescription(
						`Hai <@${discordId}>,\nKami mencatat bahwa akumulasi poin penalti kamu telah bertambah secara signifikan dan saat ini mencapai **${currentPenaltyPoints} poin**.\nIni adalah SP berkelanjutan dari kami,\n\nHubungi Management bila ada pertanyaan lebih lanjut atau kamu akan menerima hukuman fatal.`
					)
					.setColor('#FF0000')
					.setTimestamp();
				try {
					const userToDM = await __client__.users.fetch(discordId);
					if (userToDM) await userToDM.send({ embeds: [penaltyEmbed] });
				} catch (err) {}
				const warningChannel = message.guild.channels.cache.get(settings.channelLog);
				if (warningChannel) {
					warningChannel.send({ content: `🚨 **WARNING SP LANJUTAN:** Driver <@${discordId}> (Trucky ID: ${truckyId}) point penalti bertambah signifikan, total saat ini ${currentPenaltyPoints} points.` });
				}
			}

		} catch (err) {
			console.error('❌ Error processing Job completion:', err);
		}
	},
}).toJSON();
