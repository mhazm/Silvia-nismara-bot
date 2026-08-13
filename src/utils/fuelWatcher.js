module.exports = async function startFuelWatcher(client) {
	console.log('🔄 Fuel Watcher started...');
	const url = process.env.WEB_URL;

	const updateFuelPrices = async () => {
		try {
			const response = await fetch(`${url}/api/bot/fuel-price`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${process.env.NISMARA_SECRET_API}`,
				},
			});
			if (!response.ok) {
				const text = await response.text();
				console.error(
					`[Fuel Check] Server responded with status ${response.status}:`,
					text,
				);
				return;
			}

			let data;
			try {
				data = await response.json();
			} catch (parseError) {
				console.error(
					`[Fuel Check] Failed to parse JSON response. Is the endpoint URL correct? Error:`,
					parseError.message,
				);
				return;
			}

			if (data.success) {
				console.log(`[Fuel Check] Successfully updated fuel prices.`);
			} else {
				console.error(`[Fuel Check] Error:`, data);
			}
		} catch (error) {
			console.error(`[Fuel Check] Failed to fetch:`, error.message);
		}
	};

	// Jalankan sekali saat bot baru dinyalakan
	await updateFuelPrices();

	// Jalankan rutin setiap 1 jam
	setInterval(updateFuelPrices, 1000 * 60 * 60);
};
