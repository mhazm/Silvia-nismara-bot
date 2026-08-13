const { EmbedBuilder } = require('discord.js');
const LottoPeriod = require('../models/lottoPeriod');
const LottoTicket = require('../models/lottoTicket');
const Currency = require('../models/currency');
const CurrencyHistory = require('../models/currencyHistory');
const cron = require('node-cron');

const GUILD_ID = '863959415702028318';

function generateWinningNumbers() {
	const numbers = new Set();
	while (numbers.size < 4) {
		const randomNum = Math.floor(Math.random() * 69) + 1;
		numbers.add(randomNum);
	}
	return Array.from(numbers).sort((a, b) => a - b);
}

async function drawLotto(client) {
	try {
		console.log('🎰 Memulai pengundian Nismara Lotto...');

		const activePeriod = await LottoPeriod.findOne({ status: 'OPEN' });
		if (!activePeriod) {
			console.log('❌ Tidak ada Lotto Period yang aktif (OPEN).');
			return null;
		}

		// 1. Tentukan nomor pemenang
		const winningNumbers = generateWinningNumbers();
		const winningSet = new Set(winningNumbers);

		// 2. Kalkulasi hadiah
		const totalPrizePool =
			activePeriod.baseJackpot + activePeriod.accumulatedPrize;
		const tier1Pool = totalPrizePool * 0.6;
		const tier2Pool = totalPrizePool * 0.25;
		const tier3Pool = totalPrizePool * 0.15;

		// 3. Ambil semua tiket
		const tickets = await LottoTicket.find({ periodId: activePeriod._id });

		const winners = {
			tier1: [],
			tier2: [],
			tier3: [],
		};

		// 4. Periksa tiket
		for (const ticket of tickets) {
			let matches = 0;
			for (const num of ticket.numbers) {
				if (winningSet.has(num)) matches++;
			}

			if (matches === 4) winners.tier1.push(ticket);
			else if (matches === 3) winners.tier2.push(ticket);
			else if (matches === 2) winners.tier3.push(ticket);
		}

		// 5. Distribusi NC
		let rolloverPrize = 0;

		const processTier = async (tierWinners, poolAmount, tierName) => {
			if (tierWinners.length === 0) {
				rolloverPrize += poolAmount;
				return 0;
			}

			const prizePerWinner = Math.floor(poolAmount / tierWinners.length);

			// Kelompokkan hadiah per user (jika 1 user menang beberapa tiket di tier yg sama)
			const userWinnings = {};
			for (const ticket of tierWinners) {
				userWinnings[ticket.discordId] =
					(userWinnings[ticket.discordId] || 0) + prizePerWinner;
			}

			for (const [discordId, amount] of Object.entries(userWinnings)) {
				await Currency.findOneAndUpdate(
					{ userId: discordId, guildId: GUILD_ID },
					{ $inc: { totalNC: amount } },
					{ upsert: true, new: true },
				);

				await CurrencyHistory.create({
					userId: discordId,
					guildId: GUILD_ID,
					amount: amount,
					type: 'earn',
					reason: `Lotto Winner (${tierName}) - Period #${activePeriod.periodNumber}`,
				});
			}

			return prizePerWinner;
		};

		const t1Prize = await processTier(winners.tier1, tier1Pool, 'Tier 1');
		const t2Prize = await processTier(winners.tier2, tier2Pool, 'Tier 2');
		const t3Prize = await processTier(winners.tier3, tier3Pool, 'Tier 3');

		// 6. Update periode saat ini (CLOSED)
		activePeriod.status = 'DRAWN';
		activePeriod.winningNumbers = winningNumbers;
		activePeriod.endDate = new Date();
		await activePeriod.save();

		// 8. Buka periode baru dengan rollover
		await LottoPeriod.create({
			periodNumber: activePeriod.periodNumber + 1,
			status: 'OPEN',
			accumulatedPrize: rolloverPrize,
		});

		// 9. Generate Embed untuk pengumuman
		const embed = new EmbedBuilder()
			.setTitle(
				`🎰 Nismara Lotto Period #${activePeriod.periodNumber} - Hasil Undian`,
			)
			.setColor('#facc15') // yellow-400
			.setDescription(
				`**WINNING NUMBERS:**\n# \` ${winningNumbers.join(' - ')} \`\n\nTotal Prize Pool: **${totalPrizePool.toLocaleString()} N¢**\nRollover ke Periode Depan: **${rolloverPrize.toLocaleString()} N¢**`,
			)
			.addFields(
				{
					name: `🥇 Tier 1 (4 Cocok) - ${winners.tier1.length} Pemenang`,
					value:
						winners.tier1.length > 0
							? `Masing-masing mendapatkan **${t1Prize.toLocaleString()} N¢**\n${[...new Set(winners.tier1.map((t) => `<@${t.discordId}>`))].join(', ')}`
							: '*Tidak ada pemenang. Hadiah Rollover!*',
				},
				{
					name: `🥈 Tier 2 (3 Cocok) - ${winners.tier2.length} Pemenang`,
					value:
						winners.tier2.length > 0
							? `Masing-masing mendapatkan **${t2Prize.toLocaleString()} N¢**\n${[...new Set(winners.tier2.map((t) => `<@${t.discordId}>`))].join(', ')}`
							: '*Tidak ada pemenang. Hadiah Rollover!*',
				},
				{
					name: `🥉 Tier 3 (2 Cocok) - ${winners.tier3.length} Pemenang`,
					value:
						winners.tier3.length > 0
							? `Masing-masing mendapatkan **${t3Prize.toLocaleString()} N¢**\n${[...new Set(winners.tier3.map((t) => `<@${t.discordId}>`))].join(', ')}`
							: '*Tidak ada pemenang. Hadiah Rollover!*',
				},
			)
			.setFooter({
				text: `Selamat kepada para pemenang! Periode #${activePeriod.periodNumber + 1} sudah dibuka.`,
			})
			.setTimestamp();

		console.log('✅ Pengundian Nismara Lotto selesai!');
		return embed;
	} catch (error) {
		console.error('❌ Terjadi kesalahan saat pengundian Lotto:', error);
		return null;
	}
}

// Fungsi untuk menjadwalkan Cron Job
function initLottoCron(client) {
	// "0 10 * * 0" -> Menit 0, Jam 10, Tiap Hari Minggu (0 = Minggu)
	cron.schedule(
		'0 10 * * 0',
		async () => {
			console.log(
				'⏳ [CRON] Memulai pengundian Lotto Mingguan (Minggu 10:00)...',
			);
			const resultEmbed = await drawLotto(client);

			if (resultEmbed && process.env.LOTTO_CHANNEL_ID) {
				const channel = client.channels.cache.get(
					process.env.LOTTO_CHANNEL_ID,
				);
				if (channel) {
					await channel.send({ embeds: [resultEmbed] });
				}
			}
		},
		{
			timezone: 'Asia/Jakarta', // Pastikan zona waktu sesuai (WIB)
		},
	);
	console.log('🔄 Lotto Draw Watcher started (Every Sunday 10:00 WIB)...');
}

module.exports = { drawLotto, initLottoCron };
