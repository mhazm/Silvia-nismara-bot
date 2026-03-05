const GuildSettings = require('../models/guildsetting');
const ContractHistory = require('../models/contractHistorys.js');
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
				const durationDays = ev.endAt
					? Math.ceil((ev.endAt - ev.setAt) / (1000 * 60 * 60 * 24))
					: 'N/A';

				await ContractHistory.create({
					guildId: ev.guildId,
					gameId: ev.gameId,
					contractName: ev.contractName,
					companyName: ev.companyName,

					startDate: ev.setAt,
					endDate: ev.endAt,
					closedAt: new Date(),
					setBy: ev.setBy,
					durationDays: durationDays,

					completedContracts: ev.completedContracts,
					totalNCEarned: ev.totalNCEarned,
					totalDistance: ev.totalDistance,
					totalMass: ev.totalMass,

					contributors: ev.contributors || [],
				});

				const guild = client.guilds.cache.get(ev.guildId);
				if (!guild) {
					await Contract.deleteOne({ _id: ev._id });
					continue;
				}

				const settings = await GuildSettings.findOne({
					guildId: ev.guildId,
				});

				const gameId = ev.gameId;

				// 🎖️ Ambil Top 3 Contributor
				let topContributorsText = 'Belum ada kontribusi.';
				let participantCount = 0;

				if (ev.contributors && ev.contributors.length > 0) {
					participantCount = ev.contributors.length;

					const top3 = [...ev.contributors]
						.sort((a, b) => b.totalNC - a.totalNC) // ranking berdasarkan jumlah N¢
						.slice(0, 3);

					topContributorsText = top3
						.map((c, index) => {
							const medal =
								index === 0
									? '🥇'
									: index === 1
										? '🥈'
										: index === 2
											? '🥉'
											: '•';

							return `${medal} <@${c.driverId}> — ${c.jobs} job | ${c.totalNC.toLocaleString()} N¢`;
						})
						.join('\n');
				}

				if (settings?.eventNotifyChannel) {
					const channel = guild.channels.cache.get(
						settings.eventNotifyChannel,
					);

					if (channel) {
						const embed = new EmbedBuilder()
							.setTitle(
								`🔔 Special Contract ${ev.contractName} telah berakhir`,
							)
							.setColor('Red')
							.setDescription(
								`Special Contract **${ev.contractName}** untuk ${mapGame(gameId)} yang berjalan sejak <t:${Math.floor(ev.setAt / 1000)}:F> telah resmi berakhir.`,
							)
							.addFields(
								{
									name: '📊 Statistik Akhir',
									value:
										`• **Kontrak Selesai**: ${ev.completedContracts.toLocaleString()}\n` +
										`• **N¢ Terkumpul**: ${ev.totalNCEarned.toLocaleString()} N¢\n` +
										`• **Jarak Total**: ${Math.floor(ev.totalDistance).toLocaleString()} km\n` +
										`• **Massa Total**: ${ev.totalMass.toLocaleString()} ton\n` +
										`• **Total Partisipan**: ${participantCount} driver`,
								},
								{
									name: '🏆 Top 3 Contributor',
									value: topContributorsText,
								},
							)
							.setTimestamp();

						await channel.send({ embeds: [embed] });
					}
				}

				// 🔹 Hapus event aktif
				await Contract.deleteOne({ _id: ev._id });

				console.log(
					`✅ Special Contract ${ev.companyName} (${mapGame(ev.gameId)}) expired & history closed for guild ${ev.guildId}`,
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
