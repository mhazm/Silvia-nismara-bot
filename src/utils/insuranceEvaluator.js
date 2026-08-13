const cron = require('node-cron');
const Users = require('../models/Users');
const InsuranceClaimHistory = require('../models/insuranceClaimHistory');

module.exports = async function insuranceEvaluator(client) {
	// Berjalan setiap hari Minggu jam 00:00 WIB
	cron.schedule(
		'0 0 * * 0',
		async () => {
			console.log(
				'🔄 [CRON] Memulai evaluasi mingguan Rating Asuransi...',
			);

			try {
				const users = await Users.find({ 'insurance.status': true });

				const oneWeekAgo = new Date();
				oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

				for (const user of users) {
					const discordId = user.discordId;

					const claims = await InsuranceClaimHistory.find({
						discordId: discordId,
						createdAt: { $gte: oneWeekAgo },
					});

					const totalClaimAmount = claims.reduce(
						(acc, curr) => acc + curr.claimAmount,
						0,
					);

					let currentRating = user.insurance?.rating ?? 100;
					const THRESHOLD = 5000;

					if (totalClaimAmount >= THRESHOLD) {
						// Overclaim: Setiap kelipatan 5000, potong 5 poin
						const penaltyMultiplier = Math.floor(
							totalClaimAmount / THRESHOLD,
						);
						const pointsToDeduct = penaltyMultiplier * 5;

						currentRating -= pointsToDeduct;
					} else {
						// Underclaim: Tidak mencapai 5000, tambah 5 poin
						currentRating += 5;
					}

					if (currentRating > 100) currentRating = 100;
					if (currentRating < 0) currentRating = 0;

					await Users.updateOne(
						{ discordId: discordId },
						{ $set: { 'insurance.rating': currentRating } },
					);
				}

				console.log('✅ [CRON] Evaluasi Rating Asuransi selesai.');
			} catch (error) {
				console.error(
					'❌ [CRON] Gagal mengevaluasi Rating Asuransi:',
					error,
				);
			}
		},
		{
			timezone: 'Asia/Jakarta',
		},
	);

	console.log(
		'⏳ [CRON] Module Evaluasi Rating Asuransi (Mingguan) berhasil diaktifkan!',
	);
};
