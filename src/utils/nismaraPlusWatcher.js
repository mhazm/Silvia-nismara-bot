const Users = require('../models/Users');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startNismaraPlusWatcher(client) {
	console.log('🔄 Nismara+ Watcher started...');

	const checkNismaraPlus = async () => {
		try {
			const now = new Date();

			// 1. Check for expired subscriptions
			const expiredUsers = await Users.find({
				'nismaraplus.status': true,
				'nismaraplus.expiredAt': { $lte: now },
			});

			for (const user of expiredUsers) {
				user.nismaraplus.status = false;
				user.nismaraplus.notified3d = false;
				await user.save();

				if (user.discordId) {
					try {
						const discordUser = await client.users.fetch(
							user.discordId,
						);
						if (discordUser) {
							const embed = new EmbedBuilder()
								.setTitle('❌ Langganan Nismara+ Berakhir')
								.setColor('Red')
								.setDescription(
									'Masa aktif langganan **Nismara+** kamu telah habis. Terima kasih telah menggunakan layanan Nismara+!',
								)
								.setTimestamp();
							await discordUser.send({ embeds: [embed] });
						}
					} catch (err) {
						console.error(
							`❌ Gagal mengirim DM expired ke user ${user.discordId}:`,
							err,
						);
					}
				}
				console.log(`✅ Nismara+ expired for user ${user.discordId}`);
			}

			// 2. Check for 3-day reminders
			const threeDaysFromNow = new Date(
				now.getTime() + 3 * 24 * 60 * 60 * 1000,
			);
			const expiringUsers = await Users.find({
				'nismaraplus.status': true,
				'nismaraplus.expiredAt': {
					$lte: threeDaysFromNow,
					$gt: now,
				},
				'nismaraplus.notified3d': { $ne: true },
			});

			for (const user of expiringUsers) {
				user.nismaraplus.notified3d = true;
				await user.save();

				if (user.discordId) {
					try {
						const discordUser = await client.users.fetch(
							user.discordId,
						);
						if (discordUser) {
							const embed = new EmbedBuilder()
								.setTitle('⚠️ Pengingat Perpanjangan Nismara+')
								.setColor('Yellow')
								.setDescription(
									`Halo! Langganan **Nismara+** kamu akan berakhir dalam **3 Hari** (pada <t:${Math.floor(
										user.nismaraplus.expiredAt.getTime() / 1000,
									)}:F>).\n\nSegera lakukan perpanjangan agar kamu tetap bisa menikmati fitur-fitur eksklusif Nismara+!`,
								)
								.setTimestamp();
							await discordUser.send({ embeds: [embed] });
						}
					} catch (err) {
						console.error(
							`❌ Gagal mengirim DM pengingat 3 hari ke user ${user.discordId}:`,
							err,
						);
					}
				}
				console.log(
					`✅ Sent 3-day Nismara+ reminder to user ${user.discordId}`,
				);
			}
		} catch (err) {
			console.error('❌ Nismara+ watcher error:', err);
		}
	};

	checkNismaraPlus();
	setInterval(checkNismaraPlus, 60_000);
};
