const {
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	AttachmentBuilder,
} = require('discord.js');
const Event = require('../../structure/Event');
const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');
const DriverRegistry = require('../../models/driverlink');
const GuildSettings = require('../../models/guildsetting');
const SpecialContractHistory = require('../../models/specialContractHistory');
const Currency = require('../../models/currency');
const CurrencyHistory = require('../../models/currencyHistory');
const NCEvent = require('../../models/ncevent');
const jobHistory = require('../../models/jobHistory');
const Contract = require('../../models/contract');
const Users = require('../../models/Users');
const { buildJobInvoice } = require('../../utils/generateManifest');

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			if (!message.guild) return;

			const settings = await GuildSettings.findOne({
				guildId: message.guild.id,
			});
			if (!settings || !settings.truckyWebhookChannel) return;
			if (message.channel.id !== settings.truckyWebhookChannel) return;

			// Izinkan jika pesan dari webhook ATAU dari bot itu sendiri
			if (!message.webhookId && message.author.id !== __client__.user.id)
				return;
			if (!message.embeds?.length) return;

			const embed = message.embeds[0];
			if (!embed.title || !embed.title.includes('Job Completed')) return;

			const match = embed.title.match(/#(\d+)/);
			if (!match) return;

			const jobId = match[1];
			const guildId = message.guild.id;

			console.log(`🔍 Detect Guild ID: ${guildId}`);
			console.log(`🚛 Detected job completed: ${jobId}`);

			const res = await fetch(
				`https://e.truckyapp.com/api/v1/job/${jobId}`,
				{
					headers: {
						'x-access-token': process.env.TRUCKY_API_KEY,
						Accept: 'application/json',
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
						Referer: 'https://nismara.web.id/',
						Origin: 'https://nismara.web.id',
					},
				},
			);

			if (!res.ok) {
				console.log('❌ Job ID tidak valid di API');
				return;
			}

			const job = await res.json();
			if (job.status !== 'completed') return;

			const truckyName = job.driver?.name;
			if (!truckyName) return;

			const gameId = job.game_id || 'unknown';
			const gameName = mapGame(job.game_id);

			const truckyId = job?.driver?.id;
			if (!truckyId) return;

			const manajerLogChannel = message.guild.channels.cache.get(
				settings.channelLog,
			);

			if (!manajerLogChannel) {
				console.log(
					'❌ Channel log manajer tidak ditemukan atau belum diatur.',
				);
			}

			const managerRoles = settings.roles?.manager || [];
			if (!managerRoles.length) return;

			const roleMentions = managerRoles
				.map((id) => `<@&${id}>`)
				.join(' ');

			const driver = await DriverRegistry.findOne({
				guildId,
				truckyId: truckyId,
			});

			if (!driver) {
				console.log('⚠️ Driver belum ter-register, skip penalty.');
				// 📢 Log ke channel
				if (manajerLogChannel) {
					manajerLogChannel.send({
						content:
							`${roleMentions}\n` +
							`⚠️ Driver **${truckyName}** (Trucky ID: ${truckyId}) telah menyelesaikan job (#${jobId}), namun belum terdaftar di sistem. Mohon untuk didaftarkan.`,
					});
				}
				return;
			}

			const discordId = driver.userId;

			// ==========================================================
			//  ⭐ FETCH JOB HISTORY
			// ==========================================================
			const driverJob = await jobHistory.findOne({
				guildId,
				jobId,
				gameId: gameId,
			});

			if (!driverJob) {
				console.log(`[JOB COMPLETED IGNORED] Job ${jobId} not found`);
				return;
			}

			if (driverJob.jobStatus !== 'ONGOING') {
				console.log(
					`[JOB COMPLETED IGNORED] Job ${jobId} status is ${driverJob.jobStatus}`,
				);
				return;
			}

			if (driverJob.status === 'completed') {
				console.log(`[JOB COMPLETED SKIPPED] Already completed`);
				return;
			}

			// ==========================================================
			//  ⭐ Validasi Job History (untuk menghindari duplikasi)
			// ==========================================================
			const lockId = `${process.pid}-${Date.now()}`;
			const LOCK_TIMEOUT = 1000 * 60 * 5;
			const now = new Date();
			const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT);

			const jobLock = await jobHistory.findOneAndUpdate(
				{
					guildId,
					jobId,
					gameId,
					jobStatus: 'ONGOING',
					$or: [
						{ status: 'failed' },
						{ status: 'ongoing' },
						{
							status: 'processing',
							lockedAt: { $lt: lockExpiry }, // 🔥 penting
						},
					],
				},
				{
					$set: {
						status: 'processing',
						lockId,
						lockedAt: now,
					},
				},
				{ new: true },
			);

			// ❌ GAGAL LOCK
			if (!jobLock || jobLock.lockId !== lockId) {
				console.log(`⛔ Job #${jobId} lock failed or already handled.`);
				return;
			}

			// ==========================================================
			// Perhitungan Pengeluaran
			// =========================================================

			let cost = {
				rent: 0,
				service: 0,
				fuel: 0,
				total: 0,
			};

			// Biaya Sewa
			if (job.rent_cost_total > 0) {
				cost.rent = Math.round(job.rent_cost_total / 30);
			}

			// Biaya Service
			const serviceDetails = JSON.parse(job.damage_cost_details);

			const cargoDamageCost =
				Math.round(serviceDetails?.cargo_damage / 30) || 0;
			const vehicleDamageCost =
				Math.round(serviceDetails?.vehicle_damage / 30) || 0;
			const trailerDamageCost =
				Math.round(serviceDetails?.trailers_damage / 30) || 0;

			cost.service = Math.round(
				cargoDamageCost + vehicleDamageCost + trailerDamageCost,
			);
			console.log(
				`💰 Service Cost: ${cost.service} N¢ (Cargo: ${cargoDamageCost}, Vehicle: ${vehicleDamageCost}, Trailer: ${trailerDamageCost})`,
			);

			// Perhitungan Total Pengeluaran
			cost.total = Math.round(cost.rent + cost.service + cost.fuel);

			// ==========================================================
			//  ⭐ UNIVERSAL NC REWARD SYSTEM (CLEAN + MODULAR)
			// ==========================================================

			const km = Number(job.driven_distance_km || 0);

			// Reward map (agar mudah dikembangkan)
			let reward = {
				base: 0,
				special: 0,
				hardcore: 0,
				event: 0,
				booster: 0,
				total: 0,
			};

			// ==========================================================
			//  1️⃣ SPECIAL CONTRACT CHECK
			// ==========================================================

			const activeSC = await jobHistory.findOne({
				guildId,
				driverId: discordId,
				jobId: String(jobId),
				gameId: gameId,
				isSpecialContract: true,
			});

			let isSpecialContract = false;

			if (activeSC && activeSC.jobId === String(jobId)) {
				isSpecialContract = true;

				reward.special = Math.round(km * 2); // special job = 2x

				activeSC.active = false;
				await activeSC.save();

				await SpecialContractHistory.create({
					guildId,
					driverId: discordId,
					jobId,
					gameId: gameId,
					destination: job.destination_company_name || '',
					source: job.source_company_name || '',
					distanceKm: km,
					ncEarned: reward.special,
					revenue: job.revenue ?? 0,
					cargoName: job.cargo_name,
					cargoMass: job.cargo_mass_t ?? 0,
					rating: job.delivery_rating_details?.rating ?? 0,
					completedAt: new Date(),
				});

				console.log(
					`⭐ Special Contract ${gameName} Detected → +${reward.special} NC`,
				);
			}

			// ==========================================================
			//  2️⃣ BASE NC — STANDARD JOB (1km = 1NC)
			// ==========================================================

			if (!isSpecialContract) {
				reward.base = Math.round(km * 1);
				console.log(`💰 Base NC Earned: +${reward.base}`);
			}

			// ==========================================================
			//  3️⃣ HARDCORE BONUS (1km = +1NC)
			// ==========================================================

			const isHardcore =
				(job.realistic_ldb_points && job.realistic_ldb_points > 0) ||
				(job.realistic_leaderboard &&
					job.realistic_leaderboard == true);

			if (isHardcore) {
				reward.hardcore = Math.round(km * 1);
				await jobHistory.findOneAndUpdate(
					{ guildId, jobId, gameId },
					{
						$set: {
							isHardcore: true,
							hardcoreRating: job.delivery_rating_details?.rating,
						},
					},
				);
				console.log(`🔥 Hardcore Bonus: +${reward.hardcore}`);
			}

			// ==========================================================
			//  4️⃣ EVENT MULTIPLIER (OTOMATIS SIAP DIPAKAI)
			// ==========================================================
			let isActiveEvent = false;

			const activeEvent = await NCEvent.findOne({ guildId });

			if (activeEvent && activeEvent.endAt > new Date()) {
				isActiveEvent = true;
				eventMultiplier = activeEvent.multiplier;
				reward.event = Math.round(km * eventMultiplier);
				console.log(`🎉 Event NC Boost aktif → x${eventMultiplier}`);
			} else {
				console.log('No NC event active.');
			}

			// ==========================================================
			//  💎 BOOSTER NC BONUS (OTOMATIS)
			// ==========================================================
			try {
				// Ambil data member langsung dari server
				const member = await message.guild.members.fetch(discordId);

				// 💡 Opsi 1: Menggunakan deteksi otomatis dari Discord (Paling Aman & Direkomendasikan)
				const isBoosting = member.premiumSinceTimestamp !== null;

				// 💡 Opsi 2: Jika kamu tetap ingin menggunakan Role ID dari Settings
				// const isBoosting =
				// 	settings.roles?.booster &&
				// 	member.roles.cache.has(settings.roles.booster);

				let bonusBooster = 0;

				if (km > 5000) {
					bonusBooster = 600;
				} else if (km > 4000) {
					bonusBooster = 500;
				} else if (km > 3000) {
					bonusBooster = 400;
				} else if (km > 2000) {
					bonusBooster = 300;
				} else if (km > 1000) {
					bonusBooster = 200;
				} else if (km > 150) {
					bonusBooster = 100;
				}

				if (isBoosting) {
					// Contoh: Beri bonus 20% dari total kilometer (0.20 NC per Km)
					reward.booster = Math.round(km * 0.2 + bonusBooster);
					console.log(
						`💎 Server Booster Detected → +${reward.booster} NC`,
					);
				}
			} catch (error) {
				console.log(
					`⚠️ Gagal mengecek status booster untuk user ${discordId}`,
				);
			}

			// ==========================================================
			//  5️⃣ TOTAL NC
			// ==========================================================

			// TOTAL FINAL NC
			reward.total = Math.round(
				reward.base +
					reward.special +
					reward.hardcore +
					reward.event +
					reward.booster,
			);

			const rewardTotal = Math.round(reward.total - cost.total);

			console.log('--------------------------------------');
			console.log(`🏦 FINAL NC FOR JOB #${jobId}`);
			console.log(`Base     : ${reward.base}`);
			console.log(`Special  : ${reward.special}`);
			console.log(`Hardcore : ${reward.hardcore}`);
			console.log(`Event    : ${reward.event}`);
			console.log(`Booster  : ${reward.booster}`);
			console.log(`TOTAL EARNED : ${reward.total}`);
			console.log(`--------------------------------------`);
			console.log(`Rental   : ${cost.rent}`);
			console.log(`Service  : ${cost.service}`);
			console.log(`Fuel     : ${cost.fuel}`);
			console.log(`TOTAL COST : ${cost.total}`);
			console.log(`--------------------------------------`);
			console.log(`TOTAL NC : ${rewardTotal}`);
			console.log('--------------------------------------');

			// ==========================================================
			//  6️⃣ SAVE TO DATABASE
			// ==========================================================

			const updatedCurrency = await Currency.findOneAndUpdate(
				{ guildId, userId: discordId },
				{ $inc: { totalNC: rewardTotal } }, // Langsung gunakan hasil bersih (bisa plus / minus)
				{ upsert: true, new: true },
			);

			const totalCurrency = updatedCurrency ? updatedCurrency.totalNC : 0;

			const pointDb = await Point.findOne({ guildId, userId: discordId });
			const totalPoints = pointDb ? pointDb.totalPoints : 0;

			const historyRecords = [];

			if (reward.base > 0 || reward.special > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: isSpecialContract ? reward.special : reward.base,
					managerId: __client__.user.id,
					type: 'earn',
					reason: isSpecialContract
						? `Special Contract Job #${jobId}`
						: `Standard Job #${jobId}`,
				});
			}

			if (reward.hardcore > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: reward.hardcore,
					managerId: __client__.user.id,
					type: 'earn',
					reason: `Hardcore mode bonus - Job #${jobId}`,
				});
			}

			if (reward.event > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: reward.event,
					managerId: __client__.user.id,
					type: 'earn',
					reason: `NC Boost Event bonus - Job #${jobId}`,
				});
			}

			if (reward.booster > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: reward.booster,
					managerId: __client__.user.id,
					type: 'earn',
					reason: `Server Booster bonus - Job #${jobId}`,
				});
			}

			if (cost.rent > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: cost.rent,
					managerId: __client__.user.id,
					type: 'spend',
					reason: `Vehicle Rental Cost - Job #${jobId}`,
				});
			}

			if (cost.service > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: cost.service,
					managerId: __client__.user.id,
					type: 'spend',
					reason: `Vehicle Service Cost - Job #${jobId}`,
				});
			}

			if (cost.fuel > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: cost.fuel,
					managerId: __client__.user.id,
					type: 'spend',
					reason: `Fuel Cost - Job #${jobId}`,
				});
			}

			// Masukkan semua riwayat sekaligus jika ada datanya
			if (historyRecords.length > 0) {
				await CurrencyHistory.insertMany(historyRecords);
			}

			const ncField = [];
			if (reward.base > 0) {
				ncField.push({
					name: '🪙 Base NC Earned',
					value: `+${reward.base} N¢`,
					inline: true,
				});
			}

			if (reward.special > 0) {
				ncField.push({
					name: '⭐ Special Contract NC Earned',
					value: `+${reward.special} N¢`,
					inline: true,
				});
			}

			if (reward.hardcore > 0) {
				ncField.push({
					name: '🔥 Hardcore Bonus Earned',
					value: `+${reward.hardcore} N¢`,
					inline: true,
				});
			}

			if (reward.event > 0) {
				ncField.push({
					name: '🎉 Event NC Boost Earned',
					value: `+${reward.event} N¢`,
					inline: true,
				});
			}

			if (reward.booster > 0) {
				ncField.push({
					name: '💎 Server Booster Bonus Earned',
					value: `+${reward.booster} N¢`,
					inline: true,
				});
			}

			if (cost.rent > 0) {
				ncField.push({
					name: '🚗 Vehicle Rental Cost',
					value: `-${cost.rent} N¢`,
					inline: true,
				});
			}

			if (cost.service > 0) {
				ncField.push({
					name: '🔧 Vehicle Service Cost',
					value: `-${cost.service} N¢`,
					inline: true,
				});
			}

			if (cost.fuel > 0) {
				ncField.push({
					name: '⛽ Fuel Cost',
					value: `-${cost.fuel} N¢`,
					inline: true,
				});
			}

			if (cost.total > 0) {
				ncField.push({
					name: '💰 Total Cost',
					value: `-${cost.total} N¢`,
					inline: true,
				});
			}

			// EMBED REPORT NC
			if (settings.channelLog) {
				const logChannel = message.guild.channels.cache.get(
					settings.channelLog,
				);

				if (logChannel) {
					const embedLogNC = new EmbedBuilder()
						.setTitle(`🪙 | NC Reward Report - Job #${jobId}`)
						.setColor('Blue')
						.setDescription(
							`Driver: <@${discordId}>\nTotal NC Earned: **${reward.total} N¢**\nTotal Cost: **${cost.total} N¢**\nFinal NC: **${rewardTotal} N¢**`,
						)
						.addFields(ncField)
						.setTimestamp()
						.setURL(job.public_url)
						.setThumbnail(
							job.driver.avatar_url ||
								message.guild.iconURL({ forceStatic: false }),
						);
					logChannel.send({ embeds: [embedLogNC] });
				}
			}

			const distance = job.driven_distance_km ?? 0;
			const vehicle = job.vehicle_damage ?? 0;
			const trailer = job.trailers_damage ?? 0;
			const cargo = job.cargo_damage ?? 0;
			const jobType = job.stats_type ?? 0;

			// 🚨 PENALTY CALCULATION FUNCTIONS
			const gameMode = driverJob.gameMode || 'sp'; // default ke singleplayer kalau gak ada
			const distancePenalty = calcDistancePenalty(distance);
			const maximumSpeedPenalty = calcSpeedPenalty(jobType);

			let vehiclePenalty = 0;
			let trailerPenalty = 0;
			let cargoPenalty = 0;

			if (gameMode === 'truckersmp') {
				// 🚨 TruckersMP Rules
				vehiclePenalty = calcVehicleTmpPenalty(vehicle, 21);
				trailerPenalty = calcTrailerTmpPenalty(trailer, 15);
				cargoPenalty = calcCargoTmpPenalty(cargo, 11);
			} else {
				// 🌍 Default / Singleplayer Rules
				vehiclePenalty = calcVehiclePenalty(vehicle);
				trailerPenalty = calcTrailerPenalty(trailer);
				cargoPenalty = calcCargoPenalty(cargo);
			}

			const totalPenalty =
				vehiclePenalty +
				trailerPenalty +
				cargoPenalty +
				maximumSpeedPenalty +
				distancePenalty;

			const currentPenaltyPoints = totalPoints + totalPenalty;

			const penaltyData = {
				vehicle: vehiclePenalty,
				trailer: trailerPenalty,
				cargo: cargoPenalty,
				speed: maximumSpeedPenalty,
				distance: distancePenalty,
				total: totalPenalty,
			};

			// Build dynamic fields — hanya tampil kalau ada poin
			const fields = [];

			if (totalPenalty > 0) {
				fields.push({
					name: '⚖️ Penalty Rule Set',
					value:
						gameMode === 'truckersmp'
							? 'TruckersMP Damage Rule'
							: 'Standard Damage Rule',
				});
			}

			if (gameName) {
				fields.push({
					name: '🌐 Game',
					value: gameName,
				});
			}
			if (reward.base > 0) {
				fields.push({
					name: '🪙 Base NC Earned',
					value: `+${reward.base} N¢`,
					inline: true,
				});
			}

			if (reward.hardcore > 0) {
				fields.push({
					name: '🔥 Hardcore Bonus Earned',
					value: `+${reward.hardcore} N¢`,
					inline: true,
				});
			}

			if (reward.event > 0) {
				fields.push({
					name: '🎉 Event N¢ Boost Earned',
					value: `+${reward.event} N¢`,
					inline: true,
				});
			}

			if (reward.booster > 0) {
				fields.push({
					name: '💎 Server Booster Bonus Earned',
					value: `+${reward.booster} N¢`,
					inline: true,
				});
			}

			if (reward.total > 0) {
				fields.push({
					name: '🪙 Total NC Earned',
					value: `+${reward.total} N¢`,
					inline: true,
				});
			}

			if (cost.rent > 0) {
				fields.push({
					name: '🚗 Vehicle Rental Cost',
					value: `-${cost.rent} N¢`,
					inline: true,
				});
			}

			if (cost.service > 0) {
				fields.push({
					name: '🔧 Vehicle Service Cost',
					value: `-${cost.service} N¢`,
					inline: true,
				});
			}

			if (cost.fuel > 0) {
				fields.push({
					name: '⛽ Fuel Cost',
					value: `-${cost.fuel} N¢`,
					inline: true,
				});
			}

			if (cost.total > 0) {
				fields.push({
					name: '💰 Total Cost',
					value: `-${cost.total} N¢`,
					inline: true,
				});
			}

			if (vehiclePenalty > 0) {
				fields.push({
					name: '🚗 Vehicle Damage',
					value: `${vehicle}% → **${vehiclePenalty}** points`,
					inline: true,
				});
			}

			if (trailerPenalty > 0) {
				fields.push({
					name: '🚛 Trailer Damage',
					value: `${trailer}% → **${trailerPenalty}** points`,
					inline: true,
				});
			}

			if (cargoPenalty > 0) {
				fields.push({
					name: '📦 Cargo Damage',
					value: `${cargo}% → **${cargoPenalty}** points`,
					inline: true,
				});
			}

			if (distancePenalty > 0) {
				fields.push({
					name: '🛣️ Distance Penalty',
					value: `${distance} Km → **${distancePenalty}** points`,
					inline: true,
				});
			}

			if (maximumSpeedPenalty > 0) {
				fields.push({
					name: '⚡ Speed Penalty',
					value: `${formatStatsType(jobType)} → **${maximumSpeedPenalty}** points`,
					inline: true,
				});
			}

			let description;

			if (totalPenalty > 0) {
				description =
					`Terimakasih telah menyelesaikan job #${jobId} di ${gameName}!\n` +
					`Pekerjaan kamu dikategorikan sebagai ${
						isSpecialContract
							? `Special Contract Job`
							: `Standard Job`
					}.\n\n` +
					`Kamu mendapatkan total penghasilan kotor **${reward.total} N¢**\n` +
					`Saldo NC kamu sekarang adalah **${totalCurrency} N¢**.\n` +
					`⚠️ Namun, terdapat beberapa pelanggaran selama job berlangsung.\n` +
					`Dan kamu menerima **${totalPenalty} penalty points** dari job ini.\n` +
					`Sebagai pengingat, total point penalty kamu saat ini adalah **${currentPenaltyPoints} points**.`;
			} else {
				description =
					`Terimakasih telah menyelesaikan job **#${jobId}** di ${gameName}!\n` +
					`Pekerjaan kamu dikategorikan sebagai ${
						isSpecialContract
							? `Special Contract Job`
							: `Standard Job`
					}.\n\n` +
					`Kamu mendapatkan total penghasilan kotor 🪙 **${reward.total} N¢**\n` +
					`Saldo NC kamu sekarang adalah **${totalCurrency} N¢**.\n` +
					`🎉 Kamu tidak menerima penalty apapun dari job ini!`;
			}

			const embedUser = new EmbedBuilder()
				.setTitle(`💼 | Laporan Pekerjaan Selesai - Job #${jobId}`)
				.setColor(totalPenalty > 0 ? 'Red' : 'Green')
				.setDescription(description)
				.setTimestamp()
				.setThumbnail(message.guild.iconURL({ forceStatic: false }));

			// Tambahkan fields hanya kalau ada penalty
			if (fields.length > 0) {
				embedUser.addFields(fields);
			}

			// ==========================================================
			// 📄 GENERATE & ATTACH PDF MANIFEST
			// ==========================================================
			const companyLogoUrl = job.company?.avatar
				? `https://cdn.truckyapp.com/${job.company.avatar}`
				: null;

			// Buat buffer PDF secara realtime menggunakan data yang sudah dihitung di atas
			const pdfBuffer = await buildJobInvoice(
				job,
				reward,
				cost,
				rewardTotal,
				totalCurrency,
				truckyName,
				companyLogoUrl,
				penaltyData,
			);

			// Bungkus buffer menjadi attachment Discord resmi
			const pdfAttachment = new AttachmentBuilder(pdfBuffer, {
				name: `Manifest-Job-${jobId}-${job.driver.name}.pdf`,
			});

			__client__.users
				.send(discordId, {
					embeds: [embedUser],
					files: [pdfAttachment],
				})
				.catch(() => {});

			// Send special contract embed if applicable
			if (isSpecialContract) {
				// Kirim embed detail job ke channel kontrak
				const notifyChannel = message.guild.channels.cache.get(
					settings.contractChannel,
				);
				if (!notifyChannel) {
					console.log(
						'❌ Channel kontrak tidak ditemukan atau belum diatur.',
					);
				}

				const actualEndAt = Math.floor(
					new Date(job.completed_at).getTime() / 1000,
				);

				const mapMiles = {
					real_miles: 'Real Miles',
					race_miles: 'Race Miles',
				};

				const readableStats = mapMiles[job.stats_type] || 'Unknown';

				const fieldPage1 = [];
				fieldPage1.push(
					{
						name: '🌐 World',
						value: gameName,
					},
					{
						name: '🏢 Asal',
						value: job.source_company_name,
						inline: true,
					},
					{
						name: '🏭 Tujuan',
						value: job.destination_company_name,
						inline: true,
					},
					{
						name: '🚚 Rute',
						value: `${job.source_city_name} → ${job.destination_city_name} (${job.driven_distance_km} km)`,
					},
					{
						name: '📦 Kargo',
						value: `${job.cargo_name} (${job.cargo_mass_t}t)`,
						inline: true,
					},
					{
						name: '⏱️ Durasi',
						value: job.duration,
						inline: true,
					},
					{
						name: '💰 Nismara Coin Didapat',
						value: `${reward.total} N¢`,
					},
					{
						name: '📊 Tipe Statistik',
						value: formatStatsType(job.stats_type) || readableStats,
						inline: true,
					},
					{
						name: '🗓️ Waktu Selesai',
						value: `<t:${actualEndAt}:F>`,
					},
				);

				if (job.delivery_rating) {
					fieldPage1.push({
						name: '⭐ Rating Pengiriman',
						value: `${job.delivery_rating}/5`,
						inline: true,
					});
				}

				if (job.realistic_ldb_points) {
					fieldPage1.push({
						name: '🏆 Hardcore Points',
						value: `${job.realistic_ldb_points} points`,
						inline: true,
					});
				}

				// 🔹 PAGE 1 — Ringkasan Job
				const page1 = new EmbedBuilder()
					.setTitle(`📦 Special Contract Completed! - #${jobId}`)
					.setColor('Green')
					.setAuthor({
						name: job.driver.name,
						iconURL: job.driver.avatar_url,
					})
					.addFields(fieldPage1)
					.setThumbnail(job.driver.avatar_url)
					.setURL(job.public_url)
					.setTimestamp()
					.setFooter({ text: 'Halaman 1 • Ringkasan Job' });

				// 💰 PAGE 2 — Statistik Ekonomi (versi tabel)
				const page2 = new EmbedBuilder()
					.setTitle('💰 Laporan Keuangan & Statistik Ekonomi')
					.setColor('Gold');

				// 🔧 Fungsi format offence agar lebih rapi dan natural
				function formatOffenceName(offence) {
					if (!offence || typeof offence !== 'string')
						return 'Tidak diketahui';

					// Mapping manual untuk offence umum + emoji
					const map = {
						red_signal: 'Melanggar lampu merah 🚦',
						no_lights: 'Lampu tidak dinyalakan 💡',
						speeding: 'Melampaui batas kecepatan 🏎️',
						parking: 'Parkir tidak benar 🅿️',
						overload: 'Kelebihan muatan ⚖️',
						overtaking: 'Menyalip sembarangan 🚗💨',
						fatigue: 'Mengemudi dalam keadaan lelah 😴',
						crash: 'Kecelakaan lalu lintas 💥',
						late_delivery: 'Pengiriman terlambat ⏰',
						toll_violation: 'Pelanggaran tol 🚧',
						police_fine: 'Ditilang polisi 👮',
					};

					// Jika ada di mapping → tampilkan yang sudah diformat
					if (map[offence]) return map[offence];

					// fallback otomatis: ganti _ dengan spasi dan kapitalisasi kata
					return offence
						.split('_')
						.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
						.join(' ');
				}

				// pastikan job.fines_details adalah string JSON
				let finesArr = [];
				if (
					job.fines_details &&
					typeof job.fines_details === 'string' &&
					job.fines_details.length > 2
				) {
					try {
						finesArr = JSON.parse(job.fines_details);
					} catch (err) {
						console.error('Gagal parse fines_details:', err);
						finesArr = [];
					}
				}

				// hitung total fines dari data atau gunakan job.fines_total bila ada
				const finesTotalFromList =
					Array.isArray(finesArr) && finesArr.length > 0
						? finesArr.reduce((s, f) => s + (f.amount || 0), 0)
						: 0;

				// ambil biaya lain, damage, dsb
				const otherCosts = Number(job.other_costs_total || 0);
				const damageCost = Number(job.damage_cost || 0);
				const taxes = Number(job.taxes || 0);
				const rentCost = Number(job.rent_cost_total || 0);

				// hitung net profit sederhana (contoh)
				const netProfit =
					Number(job.income || 0) -
					(taxes +
						rentCost +
						otherCosts +
						damageCost +
						finesTotalFromList);

				// --- build economyReport satu code block (lebih rapi) ---
				let economyReport = [];
				economyReport.push(
					`🏦 Pendapatan Kotor  : ${Number(job.income || 0).toLocaleString()} T¢`,
				);
				economyReport.push(
					`💵 Pendapatan Bersih : ${Number(job.revenue || 0).toLocaleString()} T¢`,
				);
				economyReport.push(
					`💸 Pajak             : ${taxes.toLocaleString()} T¢`,
				);
				economyReport.push(
					`🧾 Biaya Sewa        : ${rentCost.toLocaleString()} T¢`,
				);
				economyReport.push(
					`⛽ Bahan Bakar       : ${Number(job.fuel_used_l || 0).toFixed(1)} L (${Number(job.fuel_cost || 0).toFixed(2)} T¢)`,
				);
				economyReport.push(
					`⚙️ Efisiensi BBM     : ${job.fuel_economy_l100km ?? '-'} L/100km`,
				);

				// section lain (only if exists)
				if (otherCosts > 0) {
					economyReport.push('');
					economyReport.push(
						`💼 Biaya Lain-lain   : ${otherCosts.toFixed(2)} T¢`,
					);
				}

				if (damageCost > 0) {
					let damageDetails = {};
					try {
						damageDetails = JSON.parse(
							job.damage_cost_details || '{}',
						);
					} catch (e) {
						damageDetails = {};
					}
					economyReport.push('');
					economyReport.push(
						`💥 Biaya Kerusakan   : ${damageCost.toFixed(2)} T¢`,
					);
					economyReport.push(
						`  🚛 Truk    : ${damageDetails.vehicle_damage ?? 0}T¢`,
					);
					economyReport.push(
						`  🛞 Trailer : ${damageDetails.trailers_damage ?? 0}T¢`,
					);
					economyReport.push(
						`  📦 Kargo   : ${damageDetails.cargo_damage ?? 0}T¢`,
					);
				}

				// fines (only if exists)
				if (Array.isArray(finesArr) && finesArr.length > 0) {
					economyReport.push('');
					economyReport.push('🚨 Denda :');

					const showLimit = 8;
					finesArr.slice(0, showLimit).forEach((f) => {
						const label = formatOffenceName(f.offence);
						economyReport.push(
							`• ${label} — ${Number(f.amount || 0).toLocaleString()} T¢`,
						);
					});

					if (finesArr.length > showLimit) {
						economyReport.push(
							`(+${finesArr.length - showLimit} denda lainnya)`,
						);
					}
				}

				// ringkasan akhir
				economyReport.push('');
				economyReport.push(
					`🧾 Net Profit (est)  : ${netProfit.toLocaleString()} T¢`,
				);

				// set embed description sebagai satu code block (monospace, rapi)
				page2
					.setDescription(
						'```yaml\n' + economyReport.join('\n') + '\n```',
					)
					.setTimestamp()
					.setFooter({
						text: 'Halaman 2 • Laporan Keuangan & Statistik Ekonomi',
					});

				// ⚙️ PAGE 3 — Damage & Performa
				const page3 = new EmbedBuilder()
					.setTitle('⚙️ Damage & Performa Kendaraan')
					.setColor('Red')
					.addFields(
						{
							name: '🚛 Kerusakan Truk',
							value: `${job.vehicle_damage}%`,
							inline: true,
						},
						{
							name: '🛞 Kerusakan Trailer',
							value: `${job.trailers_damage}%`,
							inline: true,
						},
						{
							name: '📦 Kerusakan Kargo',
							value: `${job.cargo_damage}%`,
							inline: true,
						},
						{
							name: '🚀 Kecepatan Maksimum',
							value: `${job.max_speed_kmh} km/h`,
							inline: true,
						},
						{
							name: '🧭 Kecepatan Rata-rata',
							value: `${job.average_speed_kmh} km/h`,
							inline: true,
						},
						{
							name: '⭐ Rating Pengiriman',
							value: `${job.delivery_rating_details?.rating ?? 0}`,
							inline: true,
						},
					)
					.setTimestamp()
					.setFooter({ text: 'Halaman 3 • Damage & Performa' });

				// === 🔍 Cek apakah data Realistic Points tersedia ===
				let pages = [page1, page2, page3];
				let options = [
					{
						label: '📄 Ringkasan Job',
						value: '0',
						description: 'Lihat ringkasan umum job',
					},
					{
						label: '💰 Statistik Ekonomi',
						value: '1',
						description: 'Pendapatan, pajak, dan bahan bakar',
					},
					{
						label: '⚙️ Damage & Performa',
						value: '2',
						description: 'Kerusakan kendaraan dan rating',
					},
				];

				// hanya tambahkan page4 kalau ada data realistis
				if (
					job.realistic_points_calculation ||
					job.realistic_ldb_points
				) {
					const rp = job.realistic_points_calculation || {};
					const drd = job.delivery_rating_details || {};
					const page4 = new EmbedBuilder()
						.setTitle('🎯 Realistic Points & Driver Rating')
						.setColor('Blue')
						.addFields(
							{
								name: '🏁 Total Poin',
								value: `${job.realistic_ldb_points ?? 0} point`,
								inline: true,
							},
							{
								name: '⭐ Rating Realistis',
								value: `⭐ ${job.delivery_rating_details?.rating ?? 0}`,
								inline: true,
							},
							{
								name: '📏 Jarak',
								value: `${rp.distance?.toFixed(1) ?? 0} point`,
								inline: true,
							},
							{
								name: '⚖️ Berat Muatan',
								value: `⭐ ${drd.massRating ?? 0} → ${rp.mass?.toFixed(1) ?? 0} point`,
								inline: true,
							},
							{
								name: '🚫 Denda',
								value: `⭐ ${rp.finesRating ?? 0} → ${rp.fines?.toFixed(1) ?? 0} point`,
								inline: true,
							},
							{
								name: '💥 Kerusakan',
								value: `⭐ ${rp.damageRating ?? 0} → ${rp.damage?.toFixed(1) ?? 0} point`,
								inline: true,
							},
							{
								name: '⛽ Efisiensi BBM',
								value: `⭐ ${rp.fuelEconomyRating ?? 0} → ${rp.fuel_economy?.toFixed(1) ?? 0} point`,
								inline: true,
							},
							{
								name: '🅿️ Parkir Ganda',
								value: `${rp.hard_parking_doubles?.toFixed(1) ?? 0} point`,
								inline: true,
							},
						)
						.setTimestamp()
						.setFooter({ text: 'Halaman 4 • Realistic Points' });

					pages.push(page4);
					options.push({
						label: '🎯 Realistic Points',
						value: '3',
						description: 'Poin realistis dan performa driver',
					});
				}

				// 🔹 Buat Select Menu
				const menu = new StringSelectMenuBuilder()
					.setCustomId('page_select')
					.setPlaceholder('📑 Pilih halaman untuk dilihat')
					.addOptions(options);

				const row = new ActionRowBuilder().addComponents(menu);

				let currentPage = 0;
				const contractMsg = await notifyChannel.send({
					content: `✅ **${job.driver.name}** telah menyelesaikan Special Contract!`,
					embeds: [pages[currentPage]],
					components: [row],
				});

				// Role yang boleh lihat data
				const allowedRoles = [
					...(settings.roles?.manager || []),
					...(settings.roles?.moderator || []),
				];

				// 🔹 Collector aktif sampai 1 hari (24 jam = 86400000 ms)
				const collector = contractMsg.createMessageComponentCollector({
					time: 3600000,
				});

				collector.on('collect', async (i) => {
					const member = await i.guild.members.fetch(i.user.id);
					const hasRole = member.roles.cache.some((role) =>
						allowedRoles.includes(role.id),
					);
					const isDriver = i.user.id === driver.userId;

					if (!isDriver && !hasRole) {
						return i.reply({
							content:
								'❌ Kamu tidak memiliki izin untuk melihat data job ini.',
							ephemeral: true,
						});
					}

					const selected = parseInt(i.values[0]);
					currentPage = selected;

					await i.update({
						embeds: [pages[currentPage]],
						components: [row],
					});
				});

				collector.on('end', async () => {
					menu.setDisabled(true);
					await contractMsg.edit({
						components: [
							new ActionRowBuilder().addComponents(menu),
						],
					});
				});
			}

			// End kalau tidak ada penalty

			if (totalPenalty <= 0) {
				console.log('✔ No penalty for this job.');
			}

			// ==========================================================
			//  🚨 APPLY PENALTY POINT
			// ==========================================================
			if (totalPenalty > 0) {
				const prevPointData = await Point.findOne({
					guildId,
					userId: discordId,
				});

				const prevTotalPoints = prevPointData?.totalPoints || 0;

				const updatedPoint = await Point.findOneAndUpdate(
					{ guildId, userId: discordId },
					{ $inc: { totalPoints: totalPenalty } },
					{ upsert: true, new: true },
				);

				await PointHistory.create({
					guildId,
					userId: discordId,
					managerId: __client__.user.id,
					points: totalPenalty,
					type: 'add',
					reason: `Automatic Penalty — Job #${jobId}`,
				});

				if (settings.channelLog && totalPenalty > 0) {
					const logChannel = message.guild.channels.cache.get(
						settings.channelLog,
					);

					if (logChannel) {
						const embedLog = new EmbedBuilder()
							.setTitle(
								`⚠️ Automatic Penalty Applied - Job #${jobId}`,
							)
							.setColor('Red')
							.setDescription(
								`Driver: <@${discordId}>\nTotal Penalty: **${totalPenalty} points**`,
							)
							.addFields(fields) // <-- field dinamis
							.setTimestamp()
							.setThumbnail(
								message.guild.iconURL({ forceStatic: false }),
							);

						logChannel.send({ embeds: [embedLog] });
					}
				}

				const PENALTY_THRESHOLDS = [10, 25, 50];

				for (const threshold of PENALTY_THRESHOLDS) {
					if (
						prevTotalPoints < threshold &&
						updatedPoint.totalPoints >= threshold
					) {
						// 🚨 Threshold TERLEWATI
						if (settings.memberWatcherChannel) {
							const logChannel = message.guild.channels.cache.get(
								settings.memberWatcherChannel,
							);

							if (logChannel) {
								const alertEmbed = new EmbedBuilder()
									.setTitle('🚨 Driver Penalty Alert')
									.setColor('DarkRed')
									.setDescription(
										`Driver <@${discordId}> telah mencapai **${threshold} penalty points**.`,
									)
									.addFields(
										{
											name: '📊 Total Poin Sekarang',
											value: `${updatedPoint.totalPoints} points`,
											inline: true,
										},
										{
											name: '🧾 Job Terakhir',
											value: `#${jobId}`,
											inline: true,
										},
									)
									.setTimestamp()
									.setThumbnail(
										message.guild.iconURL({
											forceStatic: false,
										}),
									);

								logChannel.send({ embeds: [alertEmbed] });
							}
						}
					}
				}
			}

			console.log('LOCK ID LOCAL:', lockId);

			const current = await jobHistory.findOne({
				guildId,
				gameId: gameId,
				jobId: String(jobId),
			});

			console.log('LOCK ID DB:', current?.lockId);

			let vehicleStatus;

			if (job.vehicle == null) {
				vehicleStatus = 'Rental';
			} else if (job.vehicle?.id) {
				vehicleStatus = 'Owned';
			}

			// ==========================================================
			//  🚛 SAVE JOB HISTORY WITH DATA
			// ==========================================================
			const result = await jobHistory.updateOne(
				{ guildId, jobId: String(jobId), gameId: gameId },
				{
					$set: {
						statsType: formatStatsType(job.stats_type),
						jobStatus: 'COMPLETED',

						distanceKm: job.driven_distance_km ?? 0,
						durationSeconds: job.real_driving_time_seconds ?? 0,
						revenue: job.revenue ?? 0,

						damage: {
							vehicle: job.vehicle_damage ?? 0,
							trailer: job.trailers_damage ?? 0,
							cargo: job.cargo_damage ?? 0,
						},

						nc: {
							base: reward.base,
							special: reward.special,
							hardcore: reward.hardcore,
							event: reward.event,
							booster: reward.booster,
							total: reward.total,
						},

						ncCost: {
							rent: cost.rent,
							service: cost.service,
							fuel: cost.fuel,
							total: cost.total,
						},

						penalty: {
							vehicle: vehiclePenalty,
							trailer: trailerPenalty,
							cargo: cargoPenalty,
							speed: maximumSpeedPenalty,
							distance: distancePenalty,
							total: totalPenalty,
						},

						vehicleStatus: vehicleStatus,
						status: 'completed',
						completedAt: new Date(job.completed_at),
						updatedAt: new Date(),
					},
					$unset: {
						lockId: '',
						lockedAt: '',
					},
				},
			);

			// Debugging logs untuk memastikan update berhasil
			if (result.matchedCount === 0) {
				console.error('❌ Final update FAILED - No document matched');
			} else {
				console.log('Job history updated:', result.nModified === 1);
			}

			// ==========================================================
			//  Contract Completion Data Entry (hanya untuk special contract)
			// ==========================================================
			if (isSpecialContract === true) {
				const nc = Number(reward.total) || 0;
				const distance = job.driven_distance_km ?? 0;
				const mass = job.cargo_mass_t ?? 0;

				// 1️⃣ Update statistik global
				await Contract.updateOne(
					{
						guildId,
						gameId,
					},
					{
						$inc: {
							completedContracts: 1,
							totalNCEarned: nc,
							totalDistance: distance,
							totalMass: mass,
						},
					},
				);

				// 2️⃣ Update contributor (atomic way)

				// Coba increment dulu
				const contributorUpdate = await Contract.updateOne(
					{
						guildId,
						gameId,
						'contributors.driverId': driver.userId,
					},
					{
						$inc: {
							'contributors.$.jobs': 1,
							'contributors.$.totalNC': nc,
							'contributors.$.totalDistance': distance,
							'contributors.$.totalMass': mass,
						},
					},
				);

				// Kalau belum ada contributor, push baru
				if (contributorUpdate.modifiedCount === 0) {
					await Contract.updateOne(
						{
							guildId,
							gameId,
						},
						{
							$push: {
								contributors: {
									driverId: driver.userId,
									jobs: 1,
									totalNC: nc,
									totalDistance: distance,
									totalMass: mass,
								},
							},
						},
					);
				}
			}

			const baseXP = km * 0.5;
			const hardcoreBonus = isHardcore ? km * 0.5 : 0;

			const specialBonus = isSpecialContract ? km * 0.3 : 0;
			const eventBonus = isActiveEvent ? km * 0.2 : 0;

			const xpGained = Math.round(
				baseXP + hardcoreBonus + specialBonus + eventBonus,
			);

			// 1. Update XP User (tanpa includeResultMetadata)
			const updatedUser = await Users.findOneAndUpdate(
				{
					$or: [{ discordId: discordId }],
				},
				{ $inc: { xp: xpGained } },
				{
					new: true, // Opsi standar Mongoose untuk me-return data SETELAH diupdate
				},
			);

			if (!updatedUser) {
				console.log(`User ${discordId} belum terdaftar di website`);
				return;
			}

			// 2. Ambil data user dari hasil update
			const user = updatedUser;
			const xpMultiplier = 500;
			const newLevel =
				Math.floor(Math.sqrt((user.xp || 0) / xpMultiplier)) + 1;

			// 3. Update level jika ada kenaikan
			if (user.level !== newLevel) {
				await Users.updateOne(
					{ _id: user._id },
					{ $set: { level: newLevel } },
				);

				console.log(`Selamat! ${discordId} naik ke level ${newLevel}`);
			}

			console.log(`✨ Driver ${truckyName} mendapatkan ${xpGained} XP!`);
		} catch (err) {
			console.error('❌ Auto penalty error:', err);
		}
	},
}).toJSON();

function calcVehiclePenalty(dmg) {
	if (dmg < 11) return 0;
	return 1 + Math.floor((dmg - 10) / 5);
}

function calcTrailerPenalty(dmg) {
	if (dmg < 8) return 0;
	return 1 + Math.floor((dmg - 7) / 7);
}

function calcCargoPenalty(dmg) {
	if (dmg < 6) return 0;
	return 1 + Math.floor((dmg - 5) / 5);
}

function calcVehicleTmpPenalty(dmg, step) {
	if (dmg < step) return 0;
	return Math.floor(dmg / step);
}

function calcTrailerTmpPenalty(dmg, step) {
	if (dmg < step) return 0;
	return Math.floor(dmg / step);
}

function calcCargoTmpPenalty(dmg, step) {
	if (dmg < step) return 0;
	return Math.floor(dmg / step);
}

function calcDistancePenalty(distance) {
	if (distance < 151) return 1;
	return 0;
}

function calcSpeedPenalty(type) {
	if (type === 'race_miles') return 2;
	return 0;
}

function formatStatsType(type) {
	if (!type) return 'Unknown';

	return type
		.split('_') // ["real", "miles"]
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1)) // ["Real", "Miles"]
		.join(' '); // "Real Miles"
}

function mapGame(game) {
	if (game === 1 || game === '1') return 'Euro Truck Simulator 2';
	if (game === 2 || game === '2') return 'American Truck Simulator';
	return 'Unknown';
}
