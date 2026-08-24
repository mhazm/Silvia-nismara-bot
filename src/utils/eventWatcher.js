const NCEvent = require('../models/ncevent');
const GuildSettings = require('../models/guildsetting');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startEventWatcher(client) {
	console.log('🔄 NC Event Watcher started...');

	setInterval(async () => {
		try {
			const now = new Date();

			// 🔹 Cari event yang dijadwalkan dan waktunya sudah mulai
			const scheduledEvents = await NCEvent.find({
				startDate: { $lte: now },
				isScheduled: true,
			});

			for (const ev of scheduledEvents) {
				const guild = client.guilds.cache.get(ev.guildId);
				if (!guild) {
					ev.isScheduled = false;
					await ev.save();
					continue;
				}

				ev.isActive = true;
				ev.isScheduled = false;
				await ev.save();

				// Simpan history (START EVENT) karena saat command setncboost dijadwalkan, history belum dibuat
				const NCEventHistory = require('../models/nceventHistory');
				await NCEventHistory.create({
					guildId: ev.guildId,
					multiplier: ev.multiplier,
					nameEvent: ev.nameEvent,
					imageUrl: ev.imageUrl,
					setBy: ev.setBy,
					startDate: ev.startDate,
				});

				const settings = await GuildSettings.findOne({
					guildId: ev.guildId,
				});

				if (settings?.eventNotifyChannel) {
					const channel = guild.channels.cache.get(
						settings.eventNotifyChannel,
					);

					if (channel) {
						const embed = new EmbedBuilder()
							.setTitle(`🔔 ${ev.nameEvent} NC Boost Event Resmi Dimulai!`)
							.setColor('Yellow')
							.setDescription(
								`Event Terjadwal **${ev.nameEvent}** dengan multiplier **x${ev.multiplier}** sekarang telah dimulai!\n\n` +
								`🚚 Ayo lakukan pengiriman sebanyak mungkin!\n\n` +
								`🕒 Berakhir: <t:${Math.floor(ev.endAt.getTime() / 1000)}:F> (<t:${Math.floor(ev.endAt.getTime() / 1000)}:R>)`
							)
							.setTimestamp()
							.setFooter({ text: 'Nismara Transport - Event Notification' });

						if (ev.imageUrl) embed.setImage(ev.imageUrl);
						await channel.send({ embeds: [embed] });
					}
				}
				console.log(`✅ Scheduled NC Boost Event ${ev.nameEvent} started for guild ${ev.guildId}`);
			}

			// Cari event yang sudah berakhir
			const events = await NCEvent.find({
				endAt: { $lte: now },
				isActive: true,
			});

			if (!events.length) return;

			for (const ev of events) {
				const guild = client.guilds.cache.get(ev.guildId);
				if (!guild) {
					ev.isActive = false;
					await ev.save();
					continue;
				}

				const settings = await GuildSettings.findOne({
					guildId: ev.guildId,
				});

				if (settings?.eventNotifyChannel) {
					const channel = guild.channels.cache.get(
						settings.eventNotifyChannel,
					);

					if (channel) {
						const participantsCount = ev.participants ? ev.participants.length : 0;
						const totalEarned = ev.participants 
							? ev.participants.reduce((sum, p) => sum + (p.totalEarned || 0), 0)
							: 0;

						const embed = new EmbedBuilder()
							.setTitle('🔔 NC Boost Event Telah Berakhir!')
							.setColor('Red')
							.setDescription(
								`Event **${ev.nameEvent}** dengan multiplier **x${ev.multiplier}** telah resmi berakhir.\n\n` +
								`**Statistik Event:**\n` +
								`👥 Total Partisipan: **${participantsCount} Orang**\n` +
								`💰 Total Diperoleh: **${totalEarned.toLocaleString('id-ID')} NC**\n\n` +
								`Terimakasih telah berpartisipasi! 🚚💨`,
							)
							.setTimestamp();

						await channel.send({ embeds: [embed] });
					}
				}

				// 🔹 Nonaktifkan event
				ev.isActive = false;
				await ev.save();

				console.log(
					`✅ NC Event expired and set to inactive for guild ${ev.guildId}`,
				);
			}
		} catch (err) {
			console.error('❌ Event watcher error:', err);
		}
	}, 60_000); // cek tiap 1 menit
};