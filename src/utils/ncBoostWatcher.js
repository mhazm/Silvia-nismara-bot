const Users = require('../models/Users');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startNcBoostWatcher(client) {
	console.log('🔄 NC Boost Watcher started...');

	const checkExpiredBoosts = async () => {
		try {
			const now = new Date();

			// Cari semua user dengan ncBoost aktif yang expiredAt sudah terlewati
			const expiredUsers = await Users.find({
				'ncBoost.active': true,
				'ncBoost.expiredAt': { $lte: now },
			});

			if (!expiredUsers.length) return;

			for (const user of expiredUsers) {
				const prevMultiplier = user.ncBoost.multiplier || 0;
				const voucherInfo =
					user.ncBoost.voucherTitle ||
					user.ncBoost.voucherCode ||
					'NC Boost Voucher';
				const expiredTime = user.ncBoost.expiredAt;

				// Nonaktifkan ncBoost
				user.ncBoost.active = false;
				await user.save();

				console.log(
					`✅ NC Boost expired untuk user ${user.name || user.discordId} (${user.discordId})`,
				);

				// Kirim notifikasi DM ke user jika ada discordId
				if (user.discordId) {
					try {
						const discordUser = await client.users.fetch(
							user.discordId,
						);
						if (discordUser) {
							const embed = new EmbedBuilder()
								.setTitle(
									'⌛ Masa Aktif NC Boost Telah Berakhir',
								)
								.setColor('Red')
								.setDescription(
									`Halo! Masa aktif **NC Boost** kamu telah resmi berakhir pada <t:${Math.floor(
										expiredTime.getTime() / 1000,
									)}:F>.\n\nMultiplier tambahan kini telah dinonaktifkan untuk pengiriman job berikutnya.`,
								)
								.addFields(
									{
										name: '🚀 Multiplier',
										value: `x${prevMultiplier}`,
										inline: true,
									},
									{
										name: '🎟️ Voucher',
										value: voucherInfo,
										inline: true,
									},
								)
								.setFooter({
									text: 'Nismara Transport • NC Boost System',
								})
								.setTimestamp();

							await discordUser.send({ embeds: [embed] });
						}
					} catch (err) {
						if (
							err.code === 50007 ||
							err.code === 50278 ||
							err.code === 50001
						) {
							console.warn(
								`⚠️ Tidak dapat mengirim DM NC Boost expired ke user ${user.discordId} (DM ditutup)`,
							);
						} else {
							console.error(
								`❌ Gagal mengirim DM NC Boost expired ke user ${user.discordId}:`,
								err,
							);
						}
					}
				}
			}
		} catch (err) {
			console.error('❌ NC Boost Watcher error:', err);
		}
	};

	checkExpiredBoosts();
	setInterval(checkExpiredBoosts, 60_000);
};
