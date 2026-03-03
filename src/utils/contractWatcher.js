const GuildSettings = require('../models/guildsetting');
const ContractHistory = require('../models/ContractHistorys');
const Contract = require('../models/contract');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startContractWatcher(client) {
	console.log('🔄 Special Contract Watcher started...');

	setInterval(async () => {
		try {
			const now = new Date();

			// Cari event yang sudah berakhir
			const events = await Contract.find({
				endAt: { $lte: now },
			});

			if (!events.length) return;

			for (const ev of events) {
				const guild = client.guilds.cache.get(ev.guildId);
				if (!guild) {
					await Contract.deleteOne({ _id: ev._id });
					continue;
				}

				const settings = await GuildSettings.findOne({
					guildId: ev.guildId,
				});

				const gameId = ev.gameId;

				if (settings?.eventNotifyChannel) {
					const channel = guild.channels.cache.get(
						settings.eventNotifyChannel,
					);

					if (channel) {
						const embed = new EmbedBuilder()
							.setTitle(`🔔 Special Contract ${ev.companyName} telah berakhir `)
							.setColor('Red')
							.setDescription(
								`Special Contract **${ev.companyName}** untuk ${mapGame(gameId)} telah resmi berakhir.\n\n` +
								`Terimakasih telah berpartisipasi! 🚚💨`,
							)
							.setTimestamp();

						await channel.send({ embeds: [embed] });
					}
				}

				// 🔹 Tutup history event yang masih terbuka
				const history = await ContractHistory.findOne({
					guildId: ev.guildId,
					gameId: ev.gameId,
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
				await Contract.deleteOne({ _id: ev._id });

				console.log(
					`✅ Special Contract ${ev.companyName} expired & history closed for guild ${ev.guildId}`,
				);
			}
		} catch (err) {
			console.error('❌ Event watcher error:', err);
		}
	}, 60_000); // cek tiap 1 menit
};

function mapGame(game) {
	if (game === 1 || game === '1') return 'Euro Truck Simulator 2';
	if (game === 2 || game === '2') return 'American Truck Simulator';
	return 'Unknown';
}