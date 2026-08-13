const GuildSettings = require('../../models/guildsetting');
const DriverRegistry = require('../../models/driverlink');
const jobHistory = require('../../models/jobHistory');

function mapGame(game) {
	if (game === 1 || game === '1') return 'Euro Truck Simulator 2';
	if (game === 2 || game === '2') return 'American Truck Simulator';
	return 'Unknown';
}

/**
 * Validates the Discord message, fetches Trucky API data, checks the driver,
 * and acquires the distributed lock for the job.
 * 
 * @returns {Object|null} context object if successful, null if aborted
 */
async function validateAndFetchJob(client, message) {
	if (!message.guild) return null;

	const settings = await GuildSettings.findOne({
		guildId: message.guild.id,
	});
	if (!settings || !settings.truckyWebhookChannel) return null;
	if (message.channel.id !== settings.truckyWebhookChannel) return null;

	// Izinkan jika pesan dari webhook ATAU dari bot itu sendiri
	if (!message.webhookId && message.author.id !== client.user.id) return null;
	if (!message.embeds?.length) return null;

	const embed = message.embeds[0];
	if (!embed.title || !embed.title.includes('Job Completed')) return null;

	const match = embed.title.match(/#(\d+)/);
	if (!match) return null;

	const jobId = match[1];
	const guildId = message.guild.id;

	console.log(`🔍 Detect Guild ID: ${guildId}`);
	console.log(`🚛 Detected job completed: ${jobId}`);

	const res = await fetch(
		`https://e.truckyapp.com/api/v1/job/${jobId}`,
		{
			headers: {
				'x-access-token': process.env.TRUCKY_API_KEY,
				Accept: 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
				Referer: 'https://nismara.web.id/',
				Origin: 'https://nismara.web.id',
			},
		},
	);

	if (!res.ok) {
		console.log('❌ Job ID tidak valid di API');
		return null;
	}

	const job = await res.json();
	if (job.status !== 'completed') return null;

	const truckyName = job.driver?.name;
	if (!truckyName) return null;

	const gameId = job.game_id || 'unknown';
	const gameName = mapGame(job.game_id);

	const truckyId = job?.driver?.id;
	if (!truckyId) return null;

	const manajerLogChannel = message.guild.channels.cache.get(
		settings.channelLog,
	);

	if (!manajerLogChannel) {
		console.log('❌ Channel log manajer tidak ditemukan atau belum diatur.');
	}

	const managerRoles = settings.roles?.manager || [];
	const roleMentions = managerRoles.map((id) => `<@&${id}>`).join(' ');

	const driver = await DriverRegistry.findOne({
		guildId,
		truckyId: truckyId,
	});

	if (!driver) {
		console.log('⚠️ Driver belum ter-register, skip penalty.');
		if (manajerLogChannel && managerRoles.length) {
			manajerLogChannel.send({
				content:
					`${roleMentions}\n` +
					`⚠️ Driver **${truckyName}** (Trucky ID: ${truckyId}) telah menyelesaikan job (#${jobId}), namun belum terdaftar di sistem. Mohon untuk didaftarkan.`,
			});
		}
		return null;
	}

	const discordId = driver.userId;

	// ==========================================================
	//  ⭐ FETCH JOB HISTORY
	// ==========================================================
	const driverJob = await jobHistory.findOne({
		guildId,
		jobId,
		gameId: gameId,
	});

	if (!driverJob) {
		console.log(`[JOB COMPLETED IGNORED] Job ${jobId} not found`);
		return null;
	}

	if (driverJob.jobStatus !== 'ONGOING') {
		console.log(`[JOB COMPLETED IGNORED] Job ${jobId} status is ${driverJob.jobStatus}`);
		return null;
	}

	if (driverJob.status === 'completed') {
		console.log(`[JOB COMPLETED SKIPPED] Already completed`);
		return null;
	}

	// ==========================================================
	//  ⭐ Validasi Job History (untuk menghindari duplikasi)
	// ==========================================================
	const lockId = `${process.pid}-${Date.now()}`;
	const LOCK_TIMEOUT = 1000 * 60 * 5;
	const now = new Date();
	const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT);

	const jobLock = await jobHistory.findOneAndUpdate(
		{
			guildId,
			jobId,
			gameId,
			jobStatus: 'ONGOING',
			$or: [
				{ status: 'failed' },
				{ status: 'ongoing' },
				{
					status: 'processing',
					lockedAt: { $lt: lockExpiry }, // 🔥 penting
				},
			],
		},
		{
			$set: {
				status: 'processing',
				lockId,
				lockedAt: now,
			},
		},
		{ new: true },
	);

	// ❌ GAGAL LOCK
	if (!jobLock || jobLock.lockId !== lockId) {
		console.log(`⛔ Job #${jobId} lock failed or already handled.`);
		return null;
	}

	return {
		settings,
		jobId,
		guildId,
		discordId,
		truckyId,
		truckyName,
		job,
		gameId,
		gameName,
		driver,
		driverJob,
		lockId,
        roleMentions,
        manajerLogChannel,
		// Initialize structures
		cost: { rent: 0, service: 0, fuel: 0, fines: 0, total: 0 },
		reward: { base: 0, special: 0, hardcore: 0, event: 0, booster: 0, nismaraplus: 0, total: 0 },
		discount: { nismaraplus: 0, insurance: 0, total: 0 },
		xp: { base: 0, special: 0, hardcore: 0, event: 0, booster: 0, nismaraplus: 0, total: 0 },
		penalty: { vehicle: 0, trailer: 0, cargo: 0, speed: 0, distance: 0, total: 0 },
		finesEvents: [],
		vehicleStatus: 'Rental',
		fleetDataObj: { fleet_id: null, fleet_number: null, fleet_name: null, in_game_id: null },
		rentPricePerKm: 0,
		marketFuelPricePerL: 0,
		isFleetMaintenancePenalty: false,
		maintenancePenaltyAmount: 0,
		isActiveEvent: false,
		isDriverBooster: false,
		isSpecialContract: false,
		cancelPenaltyApplied: false,
	};
}

module.exports = { validateAndFetchJob, mapGame };
