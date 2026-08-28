const GuildSettings = require('../models/guildsetting');
const Contract = require('../models/contract');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startContractWatcher(client) {
	console.log('🔄 Special Contract Watcher started...');

	setInterval(async () => {
		try {
			const now = new Date();

			// Cari event yang sudah berakhir dan masih aktif
			const events = await Contract.find({
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
								`Special Contract **${ev.contractName}** untuk ${mapGame(gameId)} yang berjalan sejak <t:${Math.floor(new Date(ev.setAt).getTime() / 1000)}:F> telah resmi berakhir.`,
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

				// 🔹 Nonaktifkan event
				ev.isActive = false;
				await ev.save();

				console.log(
					`✅ Special Contract ${ev.companyName} (${mapGame(ev.gameId)}) expired & deactivated for guild ${ev.guildId}`,
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
