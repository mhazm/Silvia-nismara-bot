const cron = require('node-cron');
const Cargo = require('../models/cargo');
const CargoMarketHistory = require('../models/cargoMarketHistory');

module.exports = async function cargoMarketEvaluator(client) {
	cron.schedule(
		'0 */12 * * *',
		async () => {
			console.log(
				'🔄 [CRON] Memulai evaluasi Cargo Market (setiap 12 jam)...',
			);

			try {
				const threeDaysAgo = new Date();
				threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

				// Hapus history yang lebih lama dari 3 hari
				const deletedHistory = await CargoMarketHistory.deleteMany({
					createdAt: { $lt: threeDaysAgo },
				});

				if (deletedHistory.deletedCount > 0) {
					console.log(
						`🧹 [CRON] Berhasil menghapus ${deletedHistory.deletedCount} data CargoMarketHistory usang (>3 hari).`,
					);
				}

				const cargoes = await Cargo.find({});

				for (const cargo of cargoes) {
					let oldDemand = cargo.market_demand || 0;
					let currentDemand = oldDemand;
					let jobCount = cargo.job_count || 0;
					let basePrice = cargo.price_per_km || 0;
					let oldPrice =
						cargo.price_per_km_with_market_change || basePrice;

					if (jobCount === 0) {
						currentDemand += 2;
					}

					if (currentDemand > 100) currentDemand = 100;
					if (currentDemand < -50) currentDemand = -50;

					const newMarketPrice =
						Math.round(
							(basePrice + basePrice * (currentDemand / 100)) *
								100,
						) / 100;

					if (
						oldDemand !== currentDemand ||
						oldPrice !== newMarketPrice
					) {
						await CargoMarketHistory.create({
							cargo_id: cargo._id,
							in_game_id: cargo.in_game_id,
							old_market_demand: oldDemand,
							new_market_demand: currentDemand,
							old_price: oldPrice,
							new_price: newMarketPrice,
						});
					}

					await Cargo.updateOne(
						{ _id: cargo._id },
						{
							$set: {
								market_demand: currentDemand,
								price_per_km_with_market_change: newMarketPrice,
								job_count: 0,
							},
						},
					);
				}

				console.log('✅ [CRON] Evaluasi Cargo Market selesai.');
			} catch (error) {
				console.error(
					'❌ [CRON] Gagal mengevaluasi Cargo Market:',
					error,
				);
			}
		},
		{
			timezone: 'Asia/Jakarta',
		},
	);

	console.log(
		'⏳ [CRON] Module Evaluasi Cargo Market (12 Jam) berhasil diaktifkan!',
	);
};
