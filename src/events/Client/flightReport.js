const {
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	AttachmentBuilder,
} = require('discord.js');
const Event = require('../../structure/Event');
const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');
const PilotRegistry = require('../../models/pilotdata');
const GuildSettings = require('../../models/guildsetting');
const Currency = require('../../models/currency');
const CurrencyHistory = require('../../models/currencyHistory');
const NCEvent = require('../../models/ncevent');
const jobHistory = require('../../models/flightData');
const Contract = require('../../models/contract');
const Users = require('../../models/Users');

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			if (!message.guild) return;

			const settings = await GuildSettings.findOne({
				guildId: message.guild.id,
			});
			if (!settings || !settings.pilotFlightLogChannel) return;
			if (message.channel.id !== settings.pilotFlightLogChannel) return;

			// Izinkan jika pesan dari webhook ATAU dari bot itu sendiri
			if (!message.webhookId && message.author.id !== __client__.user.id)
				return;
			if (!message.embeds?.length) return;

			const embed = message.embeds[0];
			if (!embed.title || !embed.title.includes('Flight Completed'))
				return;

			const match = embed.title.match(/#(\d+)/);
			if (!match) return;

			const jobId = match[1];
			const guildId = message.guild.id;

			console.log(`🔍 Detect Guild ID: ${guildId}`);
			console.log(`🚛 Detected Flight completed: ${jobId}`);

			const res = await fetch(`https://fshub.io/api/v3/flight/${jobId}`, {
				headers: {
					'X-Pilot-Token': process.env.FSHUB_API_KEY,
					Accept: 'application/json',
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
					Referer: 'https://nismara.web.id/',
					Origin: 'https://nismara.web.id',
				},
			});

			if (!res.ok) {
				console.log('❌ Job ID tidak valid di API');
				return;
			}

			const response = await res.json();
			const job = response.data; // Mengambil langsung isi objek di dalam 'data'

			console.log(job);

			const pilotName = job.user?.name;
			if (!pilotName) return;

			const pilotId = job?.user?.id;
			if (!pilotId) return;

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

			const pilot = await PilotRegistry.findOne({
				guildId,
				pilotId,
			});

			if (!pilot) {
				console.log('⚠️ Driver belum ter-register, skip penalty.');
				// 📢 Log ke channel
				if (manajerLogChannel) {
					manajerLogChannel.send({
						content:
							`${roleMentions}\n` +
							`⚠️ Pilot **${pilotName}** (Fshub ID: ${pilotId}) telah menyelesaikan penerbangan (#${jobId}), namun belum terdaftar di sistem. Mohon untuk didaftarkan.`,
					});
				}
				return;
			}

			const discordId = pilot.userId;

			// ==========================================================
			//  ⭐ FETCH JOB HISTORY
			// ==========================================================
			const pilotJob = await jobHistory.findOne({
				guildId,
				jobId,
			});

			if (pilotJob) {
				console.log(
					`[JOB COMPLETED IGNORED] Job ${jobId} sudah selesai`,
				);
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

			// Fuel Price Calculation
			const avturPrice = 0.35;
			const avturUsed = job.fuel_used;

			cost.fuel = Math.round(avturPrice * avturUsed);
			console.log(
				`💰 Avtur Cost: ${cost.fuel} N¢ (Price per KG: ${avturPrice}, Avtur Used: ${avturUsed})`,
			);

			// Perhitungan Total Pengeluaran
			cost.total = Math.round(cost.rent + cost.service + cost.fuel);

			// ==========================================================
			//  ⭐ UNIVERSAL NC REWARD SYSTEM (CLEAN + MODULAR)
			// ==========================================================

			const nm = Number(job.distance?.nm || 0);

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
			//  BASE NC — STANDARD JOB (1 nm = 7 NC)
			// ==========================================================

			reward.base = Math.round(nm * 7);
			console.log(`💰 Base NC Earned: +${reward.base}`);

			// ==========================================================
			//  EVENT MULTIPLIER (OTOMATIS SIAP DIPAKAI)
			// ==========================================================
			let isActiveEvent = false;

			const activeEvent = await NCEvent.findOne({ guildId });

			if (activeEvent && activeEvent.endAt > new Date()) {
				isActiveEvent = true;
				eventMultiplier = activeEvent.multiplier;
				reward.event = Math.round(nm * eventMultiplier);
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

				if (nm > 5000) {
					bonusBooster = 800;
				} else if (nm > 4000) {
					bonusBooster = 700;
				} else if (nm > 3000) {
					bonusBooster = 600;
				} else if (nm > 2000) {
					bonusBooster = 500;
				} else if (nm > 1000) {
					bonusBooster = 400;
				} else if (nm > 150) {
					bonusBooster = 300;
				}

				if (isBoosting) {
					// Contoh: Beri bonus 20% dari total kilometer (0.20 NC per Km)
					reward.booster = Math.round(nm * 0.2 + bonusBooster);
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
			console.log(`🏦 FINAL NC FOR FLIGHT #${jobId}`);
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
				{ $inc: { totalNC: rewardTotal } },
				{ upsert: true, new: true },
			);

			const totalCurrency = updatedCurrency ? updatedCurrency.totalNC : 0;

			const pointDb = await Point.findOne({ guildId, userId: discordId });
			const totalPoints = pointDb ? pointDb.totalPoints : 0;

			const historyRecords = [];

			if (reward.base > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: reward.base,
					managerId: __client__.user.id,
					type: 'earn',
					reason: `Standard Flight #${jobId}`,
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
					reason: `NC Boost Event bonus - Flight #${jobId}`,
				});
			}

			if (reward.booster > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: reward.booster,
					managerId: __client__.user.id,
					type: 'earn',
					reason: `Server Booster bonus - Flight #${jobId}`,
				});
			}

			if (cost.rent > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: cost.rent,
					managerId: __client__.user.id,
					type: 'spend',
					reason: `Aircraft Rental Cost - Job #${jobId}`,
				});
			}

			if (cost.service > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: cost.service,
					managerId: __client__.user.id,
					type: 'spend',
					reason: `Aircraft Service Cost - Job #${jobId}`,
				});
			}

			if (cost.fuel > 0) {
				historyRecords.push({
					guildId,
					userId: discordId,
					amount: cost.fuel,
					managerId: __client__.user.id,
					type: 'spend',
					reason: `Avtur Cost - Job #${jobId}`,
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
					name: '⛽ Avtur Cost',
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
						.setTitle(`🪙 | NC Reward Report - Flight #${jobId}`)
						.setColor('Blue')
						.setDescription(
							`Driver: <@${discordId}>\nTotal NC Earned: **${reward.total} N¢**\nTotal Cost: **${cost.total} N¢**\nFinal NC: **${rewardTotal} N¢**`,
						)
						.addFields(ncField)
						.setTimestamp()
						.setURL(job.public_url)
						.setThumbnail(
							message.guild.iconURL({ forceStatic: false }),
						);
					logChannel.send({ embeds: [embedLogNC] });
				}
			}

			const landingRate = job.landing_rate;

			// 🚨 PENALTY CALCULATION FUNCTIONS
			const landingRatePenalty = calcLandingRatePenalty(landingRate);

			const totalPenalty = landingRatePenalty;

			const currentPenaltyPoints = totalPoints + totalPenalty;

			const penaltyData = {
				landingRate: landingRatePenalty,
				total: totalPenalty,
			};

			// Build dynamic fields — hanya tampil kalau ada poin
			const fields = [];

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
					name: '⛽ Avtur Cost',
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

			if (landingRatePenalty > 0) {
				fields.push({
					name: '⚡ Landing Rate Penalty',
					value: `${landingRate} → **${landingRatePenalty}** points`,
					inline: true,
				});
			}

			let description;

			if (totalPenalty > 0) {
				description =
					`Terimakasih telah menyelesaikan penerbangan #${jobId}!\n\n` +
					`Kamu mendapatkan total penghasilan kotor **${rewardTotal} N¢** dari pekerjaan ini.\n` +
					`Saldo NC kamu sekarang adalah **${totalCurrency} N¢**.\n` +
					`⚠️ Namun, terdapat beberapa pelanggaran selama job berlangsung.\n` +
					`Dan kamu menerima **${totalPenalty} penalty points** dari job ini.\n` +
					`Sebagai pengingat, total point penalty kamu saat ini adalah **${currentPenaltyPoints} points**.`;
			} else {
				description =
					`Terimakasih telah menyelesaikan penerbangan **#${jobId}**!\n\n` +
					`Kamu mendapatkan total penghasilan 🪙 **${rewardTotal} N¢** dari pekerjaan ini.\n` +
					`Saldo NC kamu sekarang adalah **${totalCurrency} N¢**.\n` +
					`🎉 Kamu tidak menerima penalty apapun dari job ini!`;
			}

			const embedUser = new EmbedBuilder()
				.setTitle(`💼 | Laporan Penerbangan Selesai - Flight #${jobId}`)
				.setColor(totalPenalty > 0 ? 'Red' : 'Green')
				.setDescription(description)
				.setTimestamp()
				.setThumbnail(message.guild.iconURL({ forceStatic: false }));

			// Tambahkan fields hanya kalau ada penalty
			if (fields.length > 0) {
				embedUser.addFields(fields);
			}

			__client__.users
				.send(discordId, {
					embeds: [embedUser],
				})
				.catch(() => {});

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
					reason: `Automatic Penalty — Flight #${jobId}`,
				});

				if (settings.channelLog && totalPenalty > 0) {
					const logChannel = message.guild.channels.cache.get(
						settings.channelLog,
					);

					if (logChannel) {
						const embedLog = new EmbedBuilder()
							.setTitle(
								`⚠️ Automatic Penalty Applied - Flight #${jobId}`,
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

			const current = await jobHistory.findOne({
				guildId,
				jobId: String(jobId),
			});

			// ==========================================================
			//  🚛 SAVE JOB HISTORY WITH DATA
			// ==========================================================
			await jobHistory.create({
				guildId,
				jobId: String(jobId),
				discordId: discordId,
				pilotId: job.user?.id,

				aircraft: {
					icao: job.aircraft?.icao,
					icao_name: job.aircraft?.icao_name,
					name: job.aircraft?.name,
					type: job.aircraft?.type,
					user_conf: {
						tail: job.aircraft?.user_conf?.tail || null,
						icao: job.aircraft?.user_conf?.icao || null,
					},
				},

				plan: {
					callsign: job.plan?.callsign,
					cruise_level: job.plan?.cruise_lvl,
					route: job.plan?.route,
				},

				fuel_used: job.fuel_used,
				landing_rate: job.landing_rate,

				distance: {
					nm: job.distance?.nm,
					km: job.distance?.km,
				},

				average: {
					spd: job.average?.spd,
				},

				max: {
					alt: job.max?.alt,
					spd: job.max?.spd,
				},

				time: job.time,

				departure: {
					icao: job.departure?.icao,
					iata: job.departure?.iata,
					name: job.departure?.name,
					time: job.departure?.time,
					geo: {
						lat: job.departure?.geo?.lat,
						lng: job.departure?.geo?.lng,
					},
					hdg: {
						mag: job.departure?.hdg?.mag,
						true: job.departure?.hdg?.true,
					},
					spd: {
						tas: job.departure?.spd?.tas,
					},
					fuel: job.departure?.fuel,
					pitch: job.departure?.pitch,
					bank: job.departure?.bank,
					wind: {
						spd: job.departure?.wind?.spd,
						dir: job.departure?.wind?.dir,
					},
				},

				arrival: {
					icao: job.arrival?.icao,
					iata: job.arrival?.iata,
					name: job.arrival?.name,
					time: job.arrival?.time,
					geo: {
						lat: job.arrival?.geo?.lat,
						lng: job.arrival?.geo?.lng,
					},
					hdg: {
						mag: job.arrival?.hdg?.mag,
						true: job.arrival?.hdg?.true,
					},
					spd: {
						tas: job.arrival?.spd?.tas,
					},
					fuel: job.arrival?.fuel,
					pitch: job.arrival?.pitch,
					bank: job.arrival?.bank,
					wind: {
						spd: job.arrival?.wind?.spd,
						dir: job.arrival?.wind?.dir,
					},
				},
			});

			const baseXP = nm * 0.5;

			const eventBonus = isActiveEvent ? nm * 0.2 : 0;

			const xpGained = Math.round(baseXP + eventBonus);

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

			console.log(`✨ Driver ${pilotName} mendapatkan ${xpGained} XP!`);
		} catch (err) {
			console.error('❌ Auto penalty error:', err);
		}
	},
}).toJSON();

function calcLandingRatePenalty(landingRate) {
	if (landingRate < -1000) return 2;
	if (landingRate < -800) return 1;
	return 0;
}
