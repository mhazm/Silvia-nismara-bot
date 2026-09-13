const Users = require('../models/Users');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startNismaraPlusWatcher(client) {
	console.log('🔄 Nismara+ Watcher started...');

	let isChecking = false;

	const checkNismaraPlus = async () => {
		if (isChecking) return;
		isChecking = true;

		try {
			const now = new Date();
			const threeDaysFromNow = new Date(
				now.getTime() + 3 * 24 * 60 * 60 * 1000,
			);

			// 1. Check for expired subscriptions
			const expiredUsers = await Users.find({
				'nismaraplus.status': true,
				'nismaraplus.expiredAt': { $ne: null, $lte: now },
			});

			for (const user of expiredUsers) {
				user.nismaraplus.status = false;
				user.nismaraplus.notified3d = false;
				await Users.updateOne(
					{ _id: user._id },
					{
						$set: {
							'nismaraplus.status': false,
							'nismaraplus.notified3d': false,
							'nismaraplus.startedAt': null,
							'nismaraplus.expiredAt': null,
						},
					},
				);

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
						if (
							err.code === 50007 ||
							err.code === 50278 ||
							err.code === 50001 ||
							err.code === 10013
						) {
							console.warn(
								`⚠️ Tidak dapat mengirim DM expired ke user ${user.discordId} (DM ditutup/tidak ada mutual guild/user tidak valid)`,
							);
						} else {
							console.error(
								`❌ Gagal mengirim DM expired ke user ${user.discordId}:`,
								err,
							);
						}
					}
				}
				console.log(`✅ Nismara+ expired for user ${user.discordId}`);
			}

			// 2. Reset notified3d jika user memperpanjang langganan (> 3 hari ke depan)
			await Users.updateMany(
				{
					'nismaraplus.status': true,
					'nismaraplus.expiredAt': {
						$ne: null,
						$gt: threeDaysFromNow,
					},
					'nismaraplus.notified3d': true,
				},
				{
					$set: { 'nismaraplus.notified3d': false },
				},
			);

			// 3. Check for 3-day reminders
			const expiringUsers = await Users.find({
				'nismaraplus.status': true,
				'nismaraplus.expiredAt': {
					$ne: null,
					$lte: threeDaysFromNow,
					$gt: now,
				},
				'nismaraplus.notified3d': { $ne: true },
			});

			for (const user of expiringUsers) {
				user.nismaraplus.notified3d = true;
				await Users.updateOne(
					{ _id: user._id },
					{ $set: { 'nismaraplus.notified3d': true } },
				);

				if (user.discordId) {
					try {
						const discordUser = await client.users.fetch(
							user.discordId,
						);
						if (discordUser) {
							const expiredTimestamp = user.nismaraplus.expiredAt
								? Math.floor(
										new Date(
											user.nismaraplus.expiredAt,
										).getTime() / 1000,
									)
								: Math.floor(Date.now() / 1000);

							const embed = new EmbedBuilder()
								.setTitle('⚠️ Pengingat Perpanjangan Nismara+')
								.setColor('Yellow')
								.setDescription(
									`Halo! Langganan **Nismara+** kamu akan berakhir dalam **3 Hari** (pada <t:${expiredTimestamp}:F>).\n\nSegera lakukan perpanjangan agar kamu tetap bisa menikmati fitur-fitur eksklusif Nismara+!`,
								)
								.setTimestamp();
							await discordUser.send({ embeds: [embed] });
						}
					} catch (err) {
						if (
							err.code === 50007 ||
							err.code === 50278 ||
							err.code === 50001 ||
							err.code === 10013
						) {
							console.warn(
								`⚠️ Tidak dapat mengirim DM pengingat 3 hari ke user ${user.discordId} (DM ditutup/tidak ada mutual guild/user tidak valid)`,
							);
						} else {
							console.error(
								`❌ Gagal mengirim DM pengingat 3 hari ke user ${user.discordId}:`,
								err,
							);
						}
					}
				}
				console.log(
					`✅ Sent 3-day Nismara+ reminder to user ${user.discordId}`,
				);
			}
		} catch (err) {
			console.error('❌ Nismara+ watcher error:', err);
		} finally {
			isChecking = false;
		}
	};

	checkNismaraPlus();
	setInterval(checkNismaraPlus, 60_000);
};
