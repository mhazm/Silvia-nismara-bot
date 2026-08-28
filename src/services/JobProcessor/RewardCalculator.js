const Cargo = require('../../models/cargo');
const jobHistory = require('../../models/jobHistory');
const SpecialContractHistory = require('../../models/specialContractHistory');
const NCEvent = require('../../models/ncevent');

/**
 * Calculates all rewards (NC) for the completed job.
 */
async function calculateRewards(context, client, message) {
	const {
		job,
		userData,
		discordId,
		guildId,
		jobId,
		gameId,
		gameName,
		driverJob,
		cost,
	} = context;
	const km = Number(job.driven_distance_km || 0);
	const now = new Date();

	const cargoData = await Cargo.findOne({
		in_game_id: job.cargo_id,
		game_id: job.game_id,
	});

	const cargoPrice =
		driverJob.lockedCargoPrice ||
		cargoData?.price_per_km_with_market_change ||
		1;
	const cargoRevenue = Math.round(km * cargoPrice);

	console.log(
		`📦 Cargo Data: ${cargoData?.name} | Price per km: ${cargoPrice} | Cargo Revenue: ${cargoRevenue}`,
	);

	const rewardKm = Math.round(km * 0.2);
	const rewardJob = Math.round(rewardKm + cargoRevenue);

	console.log(
		`💰 Reward Job: +${rewardJob} | Reward Km: ${rewardKm} | Cargo Revenue: ${cargoRevenue}`,
	);

	// 1. SPECIAL CONTRACT CHECK
	const activeSC = await jobHistory.findOne({
		guildId,
		driverId: discordId,
		jobId: String(jobId),
		gameId: gameId,
		isSpecialContract: true,
	});

	if (activeSC && activeSC.jobId === String(jobId)) {
		context.isSpecialContract = true;
		context.reward.special = Math.round(rewardJob * 2); // special job = 2x

		activeSC.active = false;
		await activeSC.save();

		await SpecialContractHistory.create({
			guildId,
			driverId: discordId,
			jobId,
			gameId: gameId,
			destination: job.destination_company_name || '',
			source: job.source_company_name || '',
			distanceKm: km,
			ncEarned: context.reward.special,
			revenue: job.revenue ?? 0,
			cargoName: job.cargo_name,
			cargoMass: job.cargo_mass_t ?? 0,
			rating: job.delivery_rating_details?.rating ?? 0,
			completedAt: new Date(),
		});

		console.log(
			`⭐ Special Contract ${gameName} Detected → +${context.reward.special} NC`,
		);
	}

	// 2. BASE NC
	if (!context.isSpecialContract) {
		context.reward.base = Math.round(rewardJob);
		console.log(`💰 Base NC Earned: +${context.reward.base}`);
	}

	// 3. HARDCORE BONUS
	const isHardcore =
		(job.realistic_ldb_points && job.realistic_ldb_points > 0) ||
		(job.realistic_leaderboard && job.realistic_leaderboard == true);

	if (isHardcore) {
		let bonusMultiplier = 0;
		const rating = job.delivery_rating_details?.rating ?? 0;

		if (rating >= 4) {
			bonusMultiplier = 1.0;
		} else if (rating >= 3) {
			bonusMultiplier = 0.6;
		} else if (rating >= 2) {
			bonusMultiplier = 0.4;
		} else {
			bonusMultiplier = 0.2;
		}

		context.reward.hardcore = Math.round(rewardJob * bonusMultiplier);
		await jobHistory.findOneAndUpdate(
			{ guildId, jobId, gameId },
			{
				$set: {
					isHardcore: true,
					hardcoreRating: rating,
				},
			},
		);
		console.log(
			`🔥 Hardcore Bonus (Rating: ${rating}, x${bonusMultiplier}): +${context.reward.hardcore}`,
		);
	}

	// 4. EVENT MULTIPLIER
	const activeEvent = await NCEvent.findOne({
		guildId,
		isActive: true,
		endAt: { $gt: new Date() },
	});

	if (activeEvent) {
		let isEligible = true;

		// Check Game ID
		if (
			activeEvent.gameId !== 'all' &&
			activeEvent.gameId !== String(gameId)
		) {
			isEligible = false;
		}

		// Check Type (Singleplayer vs TruckersMP)
		if (isEligible && activeEvent.type !== 'all') {
			const gameMode = driverJob.gameMode || 'sp';

			if (
				activeEvent.type === 'TruckersMP' &&
				gameMode !== 'truckersmp'
			) {
				isEligible = false;
			} else if (
				activeEvent.type === 'Singleplayer' &&
				gameMode !== 'sp'
			) {
				isEligible = false;
			}
		}

		if (isEligible) {
			context.isActiveEvent = true;
			const eventMultiplier = activeEvent.multiplier;
			context.reward.event = Math.round(rewardJob * eventMultiplier);

			// 🔹 Tambahkan / Update Partisipan di Database
			const participantIndex = activeEvent.participants.findIndex(
				(p) => p.discordId === discordId,
			);

			if (participantIndex !== -1) {
				activeEvent.participants[participantIndex].totalEarned +=
					context.reward.event;
			} else {
				activeEvent.participants.push({
					discordId: discordId,
					totalEarned: context.reward.event,
				});
			}

			await activeEvent.save();

			console.log(`🎉 Event NC Boost aktif → x${eventMultiplier}`);
		} else {
			console.log(
				'NC event active but job not eligible (Game/Type mismatch).',
			);
		}
	} else {
		console.log('No NC event active.');
	}

	// 5. BOOSTER NC BONUS
	try {
		const member = await message.guild.members.fetch(discordId);
		const isBoosting = member.premiumSinceTimestamp !== null;
		let bonusBooster = 0;

		if (km > 5000) bonusBooster = 600;
		else if (km > 4000) bonusBooster = 500;
		else if (km > 3000) bonusBooster = 400;
		else if (km > 2000) bonusBooster = 300;
		else if (km > 1000) bonusBooster = 200;
		else if (km > 150) bonusBooster = 100;

		if (isBoosting) {
			context.isDriverBooster = true;
			context.reward.booster = Math.round(rewardJob * 0.3 + bonusBooster);
			console.log(
				`💎 Server Booster Detected → +${context.reward.booster} NC`,
			);
		}
	} catch (error) {
		console.log(`⚠️ Gagal mengecek status booster untuk user ${discordId}`);
	}

	// 6. NISMARA PLUS BONUS
	if (
		userData &&
		userData.nismaraplus?.status &&
		userData.nismaraplus.expiredAt > now
	) {
		let bonusPlus = 0;
		if (km > 5000) bonusPlus = 600;
		else if (km > 4000) bonusPlus = 500;
		else if (km > 3000) bonusPlus = 400;
		else if (km > 2000) bonusPlus = 300;
		else if (km > 1000) bonusPlus = 200;
		else if (km > 150) bonusPlus = 100;

		context.reward.nismaraplus = Math.round(rewardJob * 0.3 + bonusPlus);
		context.isDriverNismaraPlus = true; // Just setting it loosely
		console.log(
			`💜 Nismara Plus Detected → +${context.reward.nismaraplus} NC`,
		);
	}

	// 7. BONUS TRUCKERSMP PLAYERS
	context.reward.truckersmp = 0;
	if (
		userData &&
		userData.isTmpDriver &&
		job.game_mode?.toLowerCase() === 'truckersmp'
	) {
		const vehicleDmg = job.vehicle_damage ?? 0;
		const trailerDmg = job.trailers_damage ?? 0;
		const cargoDmg = job.cargo_damage ?? 0;

		let bonusMultiplier = 0.5; // Default 50%
		if (vehicleDmg < 11 && trailerDmg < 8 && cargoDmg < 6) {
			bonusMultiplier = 1.0; // 100%
		}

		context.reward.truckersmp = Math.round(rewardJob * bonusMultiplier);
		context.isDriverTruckersmp = true;
		console.log(
			`🌐 TruckersMP Bonus Detected (${bonusMultiplier * 100}%) → +${context.reward.truckersmp} NC`,
		);
	}

	// 8. TOTAL NC CALCULATION & TAXES
	const subTotal = Math.round(
		context.reward.base +
			context.reward.special +
			context.reward.hardcore +
			context.reward.event +
			context.reward.truckersmp,
	);

	let taxRate = 0.05;
	if (subTotal >= 30000) taxRate = 0.2;
	else if (subTotal >= 20000) taxRate = 0.15;
	else if (subTotal >= 10000) taxRate = 0.1;
	else if (subTotal >= 5000) taxRate = 0.07;

	context.reward.taxRate = taxRate;
	context.reward.taxAmount = Math.round(subTotal * taxRate);
	const afterTax = subTotal - context.reward.taxAmount;

	context.reward.total = Math.round(
		afterTax +
			context.reward.booster +
			context.reward.nismaraplus,
	);

	if (context.isFleetMaintenancePenalty) {
		context.maintenancePenaltyAmount = Math.round(
			context.reward.total * 0.5,
		);
		context.reward.total -= context.maintenancePenaltyAmount;
	}

	const rewardTotal = Math.round(context.reward.total - cost.total);
	context.rewardTotal = rewardTotal; // store for further usage

	console.log('--------------------------------------');
	console.log(`🏦 FINAL NC FOR JOB #${jobId} | ${gameName}`);
	console.log(`Cargo Name : ${cargoData?.name ? cargoData.name : 'N/A'}`);
	console.log(`Cargo Price : ${cargoPrice}`);
	console.log(`Cargo Earned : ${cargoRevenue}`);
	console.log('--------------------------------------');
	console.log(`Base     : ${context.reward.base}`);
	console.log(`Special  : ${context.reward.special}`);
	console.log(`Hardcore : ${context.reward.hardcore}`);
	console.log(`Event    : ${context.reward.event}`);
	console.log(`TruckersMP  : ${context.reward.truckersmp}`);
	console.log(`Booster  : ${context.reward.booster}`);
	console.log(`Nismara Plus  : ${context.reward.nismaraplus}`);
	console.log(`TOTAL EARNED : ${context.reward.total}`);
	console.log(`--------------------------------------`);
	console.log(`Diskon Insurance  : ${context.discount.insurance}`);
	console.log(`Diskon Nismara Plus  : ${context.discount.nismaraplus}`);
	console.log(`TOTAL DISCOUNT : ${context.discount.total}`);
	console.log(`--------------------------------------`);
	console.log(`Rental   : ${cost.rent}`);
	console.log(`Service  : ${cost.service}`);
	console.log(`Fuel     : ${cost.fuel}`);
	console.log(`Fines    : ${cost.fines}`);
	console.log(`TOTAL COST : ${cost.total}`);
	console.log(`--------------------------------------`);
	console.log(
		`Maintenance Penalty : ${context.maintenancePenaltyAmount || 0}`,
	);
	console.log(
		`Tax (${(context.reward.taxRate * 100).toFixed(0)}%) : ${context.reward.taxAmount}`,
	);
	console.log(`TOTAL NC : ${rewardTotal}`);
	console.log(`--------------------------------------`);

	return context;
}

module.exports = { calculateRewards };
