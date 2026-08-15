const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');

function calcVehiclePenalty(dmg) {
	if (dmg < 11) return 0;
	return 1 + Math.floor((dmg - 10) / 5);
}

function calcTrailerPenalty(dmg) {
	if (dmg < 8) return 0;
	return 1 + Math.floor((dmg - 7) / 7);
}

function calcCargoPenalty(dmg) {
	if (dmg < 6) return 0;
	return 1 + Math.floor((dmg - 5) / 5);
}

function calcVehicleTmpPenalty(dmg, step) {
	if (dmg < step) return 0;
	return Math.floor(dmg / step);
}

function calcTrailerTmpPenalty(dmg, step) {
	if (dmg < step) return 0;
	return Math.floor(dmg / step);
}

function calcCargoTmpPenalty(dmg, step) {
	if (dmg < step) return 0;
	return Math.floor(dmg / step);
}

function calcDistancePenalty(distance) {
	if (distance < 151) return 1;
	return 0;
}

function calcSpeedPenalty(type) {
	if (type === 'race_miles') return 2;
	return 0;
}

function formatStatsType(type) {
	if (!type) return 'Unknown';
	return type
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

/**
 * Calculates Penalties and Experience Points (XP)
 */
async function calculatePenaltyAndXp(context, client) {
	const { job, driverJob, discordId, guildId } = context;

	// 1. XP CALCULATION
	const km = Number(job.driven_distance_km || 0);
	context.xp.base = Math.round(km * 0.5);
	context.xp.hardcore =
		context.reward.hardcore > 0 ? Math.round(km * 0.5) : 0;
	context.xp.special = context.isSpecialContract ? Math.round(km * 0.3) : 0;
	context.xp.event = context.isActiveEvent ? Math.round(km * 0.2) : 0;
	context.xp.booster = context.isDriverBooster ? Math.round(km * 0.2) : 0;
	context.xp.nismaraplus = context.isDriverNismaraPlus
		? Math.round(km * 0.2)
		: 0;

	context.xp.total =
		context.xp.base +
		context.xp.hardcore +
		context.xp.special +
		context.xp.event +
		context.xp.booster +
		context.xp.nismaraplus;

	// 2. PENALTY CALCULATION
	const distance = job.driven_distance_km ?? 0;
	const vehicle = job.vehicle_damage ?? 0;
	const trailer = job.trailers_damage ?? 0;
	const cargo = job.cargo_damage ?? 0;
	const jobType = job.stats_type ?? 0;

	const gameMode = driverJob.gameMode || 'sp';
	context.penalty.distance = calcDistancePenalty(distance);
	context.penalty.speed = calcSpeedPenalty(jobType);

	if (gameMode === 'truckersmp') {
		context.penalty.vehicle = calcVehicleTmpPenalty(vehicle, 21);
		context.penalty.trailer = calcTrailerTmpPenalty(trailer, 15);
		context.penalty.cargo = calcCargoTmpPenalty(cargo, 11);
	} else {
		context.penalty.vehicle = calcVehiclePenalty(vehicle);
		context.penalty.trailer = calcTrailerPenalty(trailer);
		context.penalty.cargo = calcCargoPenalty(cargo);
	}

	context.penalty.total =
		context.penalty.vehicle +
		context.penalty.trailer +
		context.penalty.cargo +
		context.penalty.speed +
		context.penalty.distance;

	const pointDb = await Point.findOne({ guildId, userId: discordId });
	context.totalPointsBefore = pointDb ? pointDb.totalPoints : 0;
	context.currentPenaltyPoints =
		context.totalPointsBefore + context.penalty.total;

	// Helper function for embedding available later
	context.formatStatsType = formatStatsType;

	// APPLY PENALTY POINT to DB
	if (context.penalty.total > 0) {
		const reason = `[Job: ${context.jobId}] Penalty`;
		await PointHistory.create({
			guildId,
			userId: discordId,
			points: context.penalty.total,
			managerId: client.user.id,
			type: 'add',
			reason,
		});

		await Point.findOneAndUpdate(
			{ guildId, userId: discordId },
			{
				$inc: {
					totalPoints: context.penalty.total,
				},
			},
			{ upsert: true, new: true },
		);
	}

	return context;
}

module.exports = { calculatePenaltyAndXp, formatStatsType };
