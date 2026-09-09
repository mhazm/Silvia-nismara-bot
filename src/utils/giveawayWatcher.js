const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const Giveaway = require('../models/giveaway');

function initGiveawayCron(client) {
	cron.schedule('* * * * *', async () => {
		try {
			const now = new Date();

			// 1. AUTO-START: Ubah status scheduled -> ongoing langsung via Mongo lokal
			const scheduledList = await Giveaway.find({
				status: 'scheduled',
				startDate: { $lte: now },
			});

			for (const g of scheduledList) {
				await Giveaway.updateOne(
					{ _id: g._id },
					{ $set: { status: 'ongoing', updatedAt: now } },
				);

				const channel = client.channels.cache.get(
					process.env.DISCORD_GIVEAWAY_CHANNEL_ID,
				);
				if (channel) {
					const embed = new EmbedBuilder()
						.setColor(0x10b981)
						.setTitle(`🎉 GIVEAWAY TELAH DIMULAI: ${g.title}`)
						.setDescription(
							`${g.description || 'Event giveaway resmi telah dibuka!'}\n\n` +
								`🚚 Selesaikan misi di game untuk tiket gratis!\n` +
								`🪙 Beli tiket ekstra: Diskon 20% khusus Nismara+ & Booster.\n\n` +
								`👉 [Ikuti Giveaway di Website](https://transport.nismara.web.id/giveaways/${g.slug})`,
						)
						.setImage(g.bannerUrl || null)
						.setTimestamp();
					await channel.send({
						content: '@everyone Giveaway baru telah dibuka!',
						embeds: [embed],
					});
				}
			}

			// 2. AUTO-DRAW: Deteksi giveaway ongoing yang endDate-nya telah lewat
			const dueList = await Giveaway.find({
				status: 'ongoing',
				endDate: { $lte: now },
			});

			for (const g of dueList) {
				// PANGGIL ENDPOINT WEBSITE 1X SAJA UNTUK EKSEKUSI PENGUNDIAN & HADIAH
				const res = await fetch(
					`${process.env.WEB_URL}/api/cron/giveaways`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${process.env.CRON_SECRET}`,
						},
						body: JSON.stringify({ giveawayId: g._id.toString() }),
					},
				);

				const data = await res.json();
				if (data.success && data.winners) {
					const channel = client.channels.cache.get(
						process.env.DISCORD_GIVEAWAY_CHANNEL_ID,
					);
					if (channel) {
						let winnerText = '';
						data.winners.forEach((w) => {
							const prizeNames = (w.rewards || [])
								.map((r) => r.title)
								.join(', ');
							winnerText += `🏆 **${w.tierTitle}:** <@${w.discordId}> (Tiket #${w.ticketNumber})\n🎁 Hadiah: ${prizeNames}\n\n`;
						});

						const winnerEmbed = new EmbedBuilder()
							.setColor(0xf59e0b)
							.setTitle(`🏆 PENGUMUMAN PEMENANG: ${g.title}`)
							.setDescription(
								`Pengundian selesai! Hadiah telah otomatis masuk ke akun:\n\n${winnerText}`,
							)
							.setImage(g.bannerUrl || null)
							.setTimestamp();

						await channel.send({
							content: '🎉 Selamat kepada para pemenang!',
							embeds: [winnerEmbed],
						});
					}
				}
			}
		} catch (err) {
			console.error('[Giveaway Cron Error]', err);
		}
	});
}

module.exports = { initGiveawayCron };
