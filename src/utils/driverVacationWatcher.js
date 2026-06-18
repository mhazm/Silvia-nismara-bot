const GuildSettings = require('../models/guildsetting');
const LeaveHistory = require('../models/leaveHistory');
const Users = require('../models/Users');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startCouponWatcher(client) {
	console.log('🔄 Member Vacation Watcher started...');

	setInterval(async () => {
		try {
			const now = new Date();

			// Cari event yang sudah berakhir
			const data = await LeaveHistory.find({
				endDate: { $lte: now },
			});

			if (!data.length) return;

			for (const ev of data) {
				const durationDays = ev.endDate
					? Math.ceil(
							(ev.endDate - ev.startDate) / (1000 * 60 * 60 * 24),
						)
					: 'N/A';

				await LeaveHistory.updateOne(
					{ _id: ev._id },
					{
						status: 'deactivated',
						closedAt: new Date(),
						durationDays: durationDays,
					},
				);

				await Users.updateOne(
					{ discordId: ev.userId },
					{ isOnLeave: false },
				);

				const userDiscordID = await Users.findOne({
					discordId: ev.userId,
				});

				const messageEmbed = new EmbedBuilder()
					.setTitle(`🔔 Pemberitahuan Cuti telah berakhir`)
					.setDescription(
						`Cuti Anda untuk periode ${ev.startDate.toLocaleDateString()} hingga ${ev.endDate.toLocaleDateString()} telah berakhir. Kami harap Anda kembali dengan semangat baru! \n\n Apabila Anda memiliki pertanyaan atau membutuhkan bantuan, jangan ragu untuk menghubungi tim HR Nismara Transport.`,
					)
					.setColor('Red')
					.addFields({
						name: '📊 Detail Cuti',
						value:
							`• **Periode Cuti**: ${ev.startDate.toLocaleDateString()} - ${ev.endDate.toLocaleDateString()}\n` +
							`• **Durasi**: ${durationDays} hari\n` +
							`• **Alasan**: ${ev.reason}`,
					})
					.setTimestamp();

				client.users.send(userDiscordID, { embeds: [messageEmbed] });

				console.log(
					`✅ Cuti untuk user ${ev.userId} telah berakhir & status diperbarui`,
				);
			}
		} catch (err) {
			console.error('❌ Event watcher error:', err);
		}
	}, 60_000); // cek tiap 1 menit
};
