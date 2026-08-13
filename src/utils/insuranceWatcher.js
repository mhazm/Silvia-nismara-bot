const Users = require('../models/Users');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startInsuranceWatcher(client) {
	console.log('🔄 Insurance Watcher started...');

	setInterval(async () => {
		try {
			const data = await Users.find({
				'insurance.status': true,
				'insurance.expiredAt': { $lte: new Date() },
			});

			if (!data.length) return;

			for (const ev of data) {
				const durationDays = ev.insurance.expiredAt
					? Math.ceil(
							(ev.insurance.expiredAt - ev.insurance.startedAt) /
								(1000 * 60 * 60 * 24),
						)
					: 'N/A';

				await Users.updateOne(
					{ _id: ev._id },
					{
						'insurance.status': false,
					},
				);

				const messageEmbed = new EmbedBuilder()
					.setTitle(`🔔 Asuransi Anda Telah Berakhir`)
					.setDescription(
						`Asuransi Anda untuk periode ${ev.insurance.startedAt.toLocaleDateString('id-ID')} hingga ${ev.insurance.expiredAt.toLocaleDateString('id-ID')} telah berakhir.`,
					)
					.setColor('Red')
					.addFields({
						name: '📊 Detail Asuransi',
						value:
							`• **Periode Asuransi**: ${ev.insurance.startedAt.toLocaleDateString('id-ID')} - ${ev.insurance.expiredAt.toLocaleDateString('id-ID')}\n` +
							`• **Durasi**: ${durationDays} hari\n`,
					})
					.setTimestamp();

				if (ev.discordId) {
					try {
						await client.users.send(ev.discordId, {
							embeds: [messageEmbed],
						});
					} catch (err) {
						console.error(
							`❌ Gagal mengirim DM ke user ${ev.discordId}:`,
							err,
						);
					}
				}

				console.log(
					`✅ Asuransi untuk user ${ev.discordId} telah berakhir & status diperbarui`,
				);
			}
		} catch (err) {
			console.error('❌ Event watcher error:', err);
		}
	}, 60_000); // cek tiap 1 menit
};
