const NCEvent = require('../models/ncevent');
const GuildSettings = require('../models/guildsetting');
const NCEventHistory = require('../models/nceventHistory');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startEventWatcher(client) {
	console.log('🔄 NC Event Watcher started...');

	setInterval(async () => {
		try {
			const now = new Date();

			// Cari event yang sudah berakhir
			const events = await NCEvent.find({
				endAt: { $lte: now },
			});

			if (!events.length) return;

			for (const ev of events) {
				const guild = client.guilds.cache.get(ev.guildId);
				if (!guild) {
					await NCEvent.deleteOne({ _id: ev._id });
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
						const embed = new EmbedBuilder()
							.setTitle('🔔 NC Boost Event Telah Berakhir!')
							.setColor('Red')
							.setDescription(
								`Event **${ev.nameEvent}** dengan multiplier **x${ev.multiplier}** telah resmi berakhir.\n\n` +
									`Terimakasih telah berpartisipasi! 🚚💨`,
							)
							.setTimestamp();

						await channel.send({ embeds: [embed] });
					}
				}

				// 🔹 Tutup history event yang masih terbuka
				const history = await NCEventHistory.findOne({
					guildId: ev.guildId,
					endDate: { $exists: false },
				}).sort({ startDate: -1 });

				if (history) {
					history.endDate = ev.endAt;
					history.durationDays = Math.ceil(
						(history.endDate - history.startDate) /
							(1000 * 60 * 60 * 24),
					);
					await history.save();
				}

				// 🔹 Hapus event aktif
				await NCEvent.deleteOne({ _id: ev._id });

				console.log(
					`✅ NC Event expired & history closed for guild ${ev.guildId}`,
				);
			}
		} catch (err) {
			console.error('❌ Event watcher error:', err);
		}
	}, 60_000); // cek tiap 1 menit
};