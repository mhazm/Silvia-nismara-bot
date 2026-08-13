module.exports = async function startGarageWatcher(client) {
	console.log('🔄 Garage Watcher started...');
	const url = process.env.WEB_URL;

	const checkGarageMaintenance = async () => {
		try {
			const response = await fetch(`${url}/api/cron/maintenance`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${process.env.CRON_SECRET}`,
				},
			});

			const data = await response.json();
			if (data.success) {
				console.log(
					`[Garage Check] Processed Orders: ${data.processedOrders}, Flagged: ${data.flaggedFleets}`,
				);
			} else {
				console.error(`[Garage Check] Error:`, data);
			}

			// Pengecekan Mekanik
			const mechResponse = await fetch(`${url}/api/cron/mechanics`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${process.env.CRON_SECRET}`,
				},
			});

			const mechData = await mechResponse.json();
			if (mechData.success) {
				console.log(
					`[Mechanic Check] Extended: ${mechData.extendedMechanics}, Fired: ${mechData.firedMechanics}`,
				);
			} else {
				console.error(`[Mechanic Check] Error:`, mechData);
			}

			// Pengecekan Sewa/Operasional Garasi Bulanan
			const rentResponse = await fetch(`${url}/api/cron/garage-rent`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${process.env.CRON_SECRET}`,
				},
			});

			const rentData = await rentResponse.json();
			if (rentData.success) {
				console.log(
					`[Garage Rent Check] Processed: ${rentData.processedPayments}, Failed: ${rentData.failedPayments}`,
				);
			} else {
				console.error(`[Garage Rent Check] Error:`, rentData);
			}
		} catch (error) {
			console.error(`[Garage Check] Failed to fetch:`, error);
		}
	};

	// Jalankan sekali saat bot baru dinyalakan
	await checkGarageMaintenance();

	// Jalankan rutin setiap 30 menit
	setInterval(checkGarageMaintenance, 1000 * 60 * 30);
};
