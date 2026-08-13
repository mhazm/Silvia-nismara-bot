// File: src/utils/widgetUpdater.js

// Fungsi pemformat angka (1000000 -> 1.000.000)
const formatNumber = (num) => {
	return new Intl.NumberFormat('id-ID').format(num || 0);
};

/**
 * Fungsi untuk mengupdate Widget Profil Discord
 * @param {object} client - Discord Client (bot)
 * @param {string} userId - Discord ID milik User
 * @param {object} driverData - Data driver dari MongoDB
 */
async function updateDriverWidget(client, userId, combinedData) {
	// Ambil Application ID dan Token langsung dari client Silvia
	const appId = process.env.WIDGET_APP_ID;
	const botToken = process.env.WIDGET_BOT_TOKEN;

	// Susun payload sesuai dengan key di Discord Developer Portal
	const payload = {
		data: {
			dynamic: [
				{
					type: 1,
					name: 'roles',
					value: combinedData.roleName || 'Driver',
				},
				{
					type: 1,
					name: 'userLevel',
					value: String(combinedData.level || 1),
				},
				{
					type: 1,
					name: 'totalDistance',
					value: `${formatNumber(combinedData.totalDistance)} Km`,
				},
				{
					type: 1,
					name: 'totalJobs',
					value: formatNumber(combinedData.totalJobs),
				},
				{
					type: 1,
					name: 'totalCompletedJobs',
					value: formatNumber(combinedData.totalCompletedJobs),
				},
				{
					type: 1,
					name: 'totalCanceledJobs',
					value: formatNumber(combinedData.totalCanceledJobs),
				},
				{
					type: 1,
					name: 'totalEarnings',
					value: `${formatNumber(combinedData.walletBalance)} NC`,
				},
				{
					type: 3,
					name: 'widgetImage',
					value: {
						url:
							combinedData.widgetImage ||
							'https://images.nismara.my.id/Nismara_widget_default.png',
					},
				},
				{
					type: 1,
					name: 'driverName',
					value: combinedData.driverName,
				},
				{
					type: 1,
					name: 'userJoinedDate',
					value: combinedData.userJoinedDate,
				},
				{
					type: 1,
					name: 'totalPenalty',
					value: formatNumber(combinedData.totalPenalty),
				},
				{
					type: 1,
					name: 'name',
					value: combinedData.name,
				},
			],
		},
	};

	try {
		// Karena kita di Node.js 18+, kita bisa pakai fetch bawaan
		const response = await fetch(
			`https://discord.com/api/v9/applications/${appId}/users/${userId}/identities/0/profile`,
			{
				method: 'PATCH',
				headers: {
					Authorization: `Bot ${botToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			},
		);

		if (!response.ok) {
			const errorData = await response.json();
			console.error(`[WIDGET] Gagal update untuk ${userId}:`, errorData);
			return false;
		}

		console.log(`[WIDGET] ✅ Sukses update widget untuk user ${userId}`);
		return true;
	} catch (error) {
		console.error(`[WIDGET] ❌ Error saat memanggil API Discord:`, error);
		return false;
	}
}

module.exports = { updateDriverWidget };

// Pastikan Anda sudah meng-import model JobHistories
const JobHistories = require('../models/jobHistory'); // Sesuaikan dengan path Anda

/**
 * Fungsi untuk mengambil statistik pekerjaan (jobs) milik driver secara dinamis
 * @param {string} discordId - ID Discord dari User/Driver
 * @returns {Promise<Object>} Object berisi totalJobs, totalCompleted, totalCanceled, totalDistance
 */
async function getDriverJobStats(discordId) {
	try {
		const stats = await JobHistories.aggregate([
			// 1. Filter data hanya untuk user dengan driverId yang sesuai
			{ $match: { driverId: discordId } },
			// 2. Lakukan perhitungan kalkulasi (Grouping)
			{
				$group: {
					_id: null,
					// Menghitung semua riwayat job yang ada untuk driver ini
					totalJobs: { $sum: 1 },
					// Menjumlahkan job jika jobStatus = 'COMPLETED'
					totalCompletedJobs: {
						$sum: {
							$cond: [{ $eq: ['$jobStatus', 'COMPLETED'] }, 1, 0],
						},
					},
					// Menjumlahkan job jika jobStatus = 'CANCELED'
					totalCanceledJobs: {
						$sum: {
							$cond: [{ $eq: ['$jobStatus', 'CANCELED'] }, 1, 0],
						},
					},
					// Menjumlahkan distanceKm khusus untuk job yang 'COMPLETED' saja
					totalDistance: {
						$sum: {
							$cond: [
								{ $eq: ['$jobStatus', 'COMPLETED'] },
								'$distanceKm',
								0,
							],
						},
					},
				},
			},
		]);

		// Jika user memiliki riwayat job, stats akan berisi array dengan 1 element.
		// Jika tidak punya riwayat, kita kembalikan angka 0.
		if (stats.length > 0) {
			return stats[0];
		} else {
			return {
				totalJobs: 0,
				totalCompletedJobs: 0,
				totalCanceledJobs: 0,
				totalDistance: 0,
			};
		}
	} catch (error) {
		console.error(
			`Gagal menghitung statistik job untuk user ${discordId}:`,
			error,
		);
		// Fallback jika error (misal database putus)
		return {
			totalJobs: 0,
			totalCompletedJobs: 0,
			totalCanceledJobs: 0,
			totalDistance: 0,
		};
	}
}
