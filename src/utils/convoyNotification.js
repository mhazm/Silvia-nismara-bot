const ConvoyLobby = require('../models/convoyLobby');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startConvoyNotificationWatcher(client) {
	console.log('🔄 Convoy Notification Watcher started...');

	const checkConvoys = async () => {
		try {
			const now = new Date();
			// We want convoys that will meetup in less than or equal to 1 hour
			const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

			// Find active convoys that are going to meetup in <= 1 hour and haven't been notified yet
			const convoys = await ConvoyLobby.find({
				active: true,
				meetupDate: { $lte: oneHourFromNow },
				notified1h: { $ne: true },
			});

			for (const convoy of convoys) {
				if (convoy.interested && convoy.interested.length > 0) {
					for (const userId of convoy.interested) {
						try {
							const user = await client.users.fetch(userId);
							if (user) {
								const embed = new EmbedBuilder()
									.setTitle('🚀 Convoy Reminder!')
									.setColor('Blue')
									.setDescription(
										`Halo! Convoy **${convoy.convoyName}** yang kamu minati akan dimulai dalam **1 Jam**!\n\n**Meetup Date:** <t:${Math.floor(
											convoy.meetupDate.getTime() / 1000,
										)}:F>\n\nJangan lupa siapkan truck dan join ke lobby sebelum meetup ya! 🚚💨`,
									)
									.setTimestamp();

								// Adding thumbnail/image if available
								if (convoy.imageUrl) {
									embed.setImage(convoy.imageUrl);
								}

								await user.send({ embeds: [embed] });
							}
						} catch (dmErr) {
							if (
								dmErr.code === 50007 ||
								dmErr.code === 50278 ||
								dmErr.code === 50001
							) {
								console.warn(
									`⚠️ Tidak dapat mengirim DM reminder konvoi ke user ${userId} (DM ditutup/tidak ada mutual guild)`,
								);
							} else {
								console.error(
									`❌ Gagal mengirim DM ke user ${userId} untuk convoy ${convoy.convoyName}:`,
									dmErr,
								);
							}
						}
					}
				}

				convoy.notified1h = true;
				await convoy.save();
				console.log(
					`✅ Sent 1 hour reminder for convoy ${convoy.convoyName}`,
				);
			}

			// Find convoys that have been active for > 3 hours since startDate and close them
			const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
			const convoysToClose = await ConvoyLobby.find({
				active: true,
				startDate: { $lte: threeHoursAgo },
			});

			for (const convoy of convoysToClose) {
				convoy.active = false;
				await convoy.save();
				console.log(`✅ Closed convoy ${convoy.convoyName} (3 hours passed since startDate)`);
			}
		} catch (err) {
			console.error('❌ Convoy notification watcher error:', err);
		}
	};

	// Eksekusi pertama kali saat bot baru jalan
	checkConvoys();

	// Lalu eksekusi setiap 1 menit
	setInterval(checkConvoys, 60_000);
};
