const Currency = require('../../models/currency');
const CurrencyHistory = require('../../models/currencyHistory');
const jobHistory = require('../../models/jobHistory');
const Contract = require('../../models/contract');
const Users = require('../../models/Users');

/**
 * Updates all database records after a job is completed (Currency, JobHistory, Contracts, Users XP).
 */
async function updateDatabase(context, client) {
	const {
		job,
		jobId,
		guildId,
		discordId,
		gameId,
		driver,
		rewardTotal,
		reward,
		cost,
		discount,
		xp,
		penalty,
		finesEvents,
		vehicleStatus,
		fleetDataObj,
		rentPricePerKm,
		marketFuelPricePerL,
		maintenancePenaltyAmount,
		isSpecialContract,
	} = context;

	// 1. UPDATE CURRENCY
	const updatedCurrency = await Currency.findOneAndUpdate(
		{ guildId, userId: discordId },
		{
			$inc: {
				totalNC: rewardTotal,
			},
		},
		{ upsert: true, new: true }
	);
	context.totalCurrency = updatedCurrency ? updatedCurrency.totalNC : 0;

	// 2. CURRENCY HISTORY
	const historyRecords = [];

	if (reward.base > 0 || reward.special > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: isSpecialContract ? reward.special : reward.base,
			managerId: client.user.id,
			type: 'earn',
			reason: isSpecialContract ? `Special Contract Job #${jobId}` : `Standard Job #${jobId}`,
		});
	}
	if (reward.hardcore > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: reward.hardcore,
			managerId: client.user.id,
			type: 'earn',
			reason: `Hardcore mode bonus - Job #${jobId}`,
		});
	}
	if (reward.event > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: reward.event,
			managerId: client.user.id,
			type: 'earn',
			reason: `NC Boost Event bonus - Job #${jobId}`,
		});
	}
	if (reward.booster > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: reward.booster,
			managerId: client.user.id,
			type: 'earn',
			reason: `Server Booster bonus - Job #${jobId}`,
		});
	}
	if (reward.nismaraplus > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: reward.nismaraplus,
			managerId: client.user.id,
			type: 'earn',
			reason: `Nismara Plus bonus - Job #${jobId}`,
		});
	}
	if (cost.rent > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: cost.rent,
			managerId: client.user.id,
			type: 'spend',
			reason: `Vehicle Rental Cost - Job #${jobId}`,
		});
	}
	if (cost.service > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: cost.service,
			managerId: client.user.id,
			type: 'spend',
			reason: `Vehicle Service Cost - Job #${jobId}`,
		});
	}
	if (cost.fuel > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: cost.fuel,
			managerId: client.user.id,
			type: 'spend',
			reason: `Fuel Cost - Job #${jobId}`,
		});
	}
	if (cost.fines > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: cost.fines,
			managerId: client.user.id,
			type: 'spend',
			reason: `Traffic Fines Cost - Job #${jobId}`,
		});
	}
	if (maintenancePenaltyAmount > 0) {
		historyRecords.push({
			guildId,
			userId: discordId,
			amount: maintenancePenaltyAmount,
			managerId: client.user.id,
			type: 'spend',
			reason: `Vehicle Maintenance Penalty - Job #${jobId}`,
		});
	}

	if (historyRecords.length > 0) {
		await CurrencyHistory.insertMany(historyRecords);
	}

	// 3. JOB HISTORY UPDATE
	const result = await jobHistory.updateOne(
		{ guildId, jobId: String(jobId), gameId: gameId },
		{
			$set: {
				statsType: context.formatStatsType(job.stats_type),
				jobStatus: 'COMPLETED',
				distanceKm: job.driven_distance_km ?? 0,
				durationSeconds: job.real_driving_time_seconds ?? 0,
				revenue: rewardTotal ?? 0,
				damage: {
					vehicle: job.vehicle_damage ?? 0,
					trailer: job.trailers_damage ?? 0,
					cargo: job.cargo_damage ?? 0,
				},
				vehicleStatus: vehicleStatus,
				fleet_data: fleetDataObj,
				rentPricePerKm: rentPricePerKm,
				marketFuelPricePerL: marketFuelPricePerL,
				nc: reward,
				ncCost: cost,
				fines_events: finesEvents,
				discount: discount,
				xp: xp,
				maintenance_penalty: maintenancePenaltyAmount || 0,
				penalty: penalty,
				status: 'completed',
				completedAt: new Date(job.completed_at),
				updatedAt: new Date(),
			},
			$unset: { lockId: '', lockedAt: '' },
		}
	);

	if (result.matchedCount === 0) {
		console.error('❌ Final update FAILED - No document matched');
	} else {
		console.log('Job history updated:', result.modifiedCount > 0 || result.nModified === 1);
	}

	// 4. CONTRACT COMPLETION (Special Contract)
	if (isSpecialContract === true) {
		const nc = Number(reward.total) || 0;
		const distance = job.driven_distance_km ?? 0;
		const mass = job.cargo_mass_t ?? 0;

		await Contract.updateOne(
			{ guildId, gameId },
			{
				$inc: { completedContracts: 1, totalNCEarned: nc, totalDistance: distance, totalMass: mass },
			}
		);

		const contributorUpdate = await Contract.updateOne(
			{ guildId, gameId, 'contributors.driverId': driver.userId },
			{
				$inc: {
					'contributors.$.jobs': 1,
					'contributors.$.totalNC': nc,
					'contributors.$.totalDistance': distance,
					'contributors.$.totalMass': mass,
				},
			}
		);

		if (contributorUpdate.modifiedCount === 0) {
			await Contract.updateOne(
				{ guildId, gameId },
				{
					$push: {
						contributors: { driverId: driver.userId, jobs: 1, totalNC: nc, totalDistance: distance, totalMass: mass },
					},
				}
			);
		}
	}

	// 5. USER XP & LEVEL
	const updatedUser = await Users.findOneAndUpdate(
		{ discordId: discordId },
		{ $inc: { xp: xp.total } },
		{ new: true }
	);

	if (!updatedUser) {
		console.log(`User ${discordId} belum terdaftar di website`);
	} else {
		const xpMultiplier = 500;
		const newLevel = Math.floor(Math.sqrt((updatedUser.xp || 0) / xpMultiplier)) + 1;

		if (updatedUser.level !== newLevel) {
			await Users.updateOne({ _id: updatedUser._id }, { $set: { level: newLevel } });
			console.log(`Selamat! ${discordId} naik ke level ${newLevel}`);
			context.levelUp = newLevel;
		}
		console.log(`✨ Driver ${context.truckyName} mendapatkan ${xp.total} XP!`);
	}

	return context;
}

module.exports = { updateDatabase };
