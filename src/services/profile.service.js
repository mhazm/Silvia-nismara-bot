const JobHistory = require('../models/jobHistory');
const Currency = require('../models/currency');
const Point = require('../models/points');
const CurrencyHistory = require('../models/currencyHistory');
const PointHistory = require('../models/pointhistory');

const { getDriverLink } = require('./driverLink.service');
const { getCompanyMemberByTruckyId } = require('./trucky.service');

async function getProfileData(guildId, userId) {
	// =========================
	// TOTAL CURRENCY
	// =========================
	const currency = await Currency.findOne({ guildId, userId }).lean();
	if (!currency) return null;

	const userCurrency = currency.totalNC || 0;

	// =========================
	// TOTAL POINT
	// =========================
	const point = await Point.findOne({ guildId, userId }).lean();
	if (!point) return null;

	const userPoints = point.totalPoints || 0;

	// =========================
	// JOB STATS
	// =========================
	const [totalJobs, specialJobs, canceledJobs] = await Promise.all([
		JobHistory.countDocuments({ guildId, driverId: userId }),
		JobHistory.countDocuments({
			guildId,
			driverId: userId,
			isSpecialContract: 'true',
		}),
		JobHistory.countDocuments({
			guildId,
			driverId: userId,
			jobStatus: 'CANCELED',
		}),
	]);

	const recentJobs = await JobHistory.find({ guildId, driverId: userId })
		.sort({ createdAt: -1 })
		.limit(3)
		.select(
			'jobId game jobStatus sourceCompany sourceCity destinationCompany destinationCity cargoName cargoMass',
		)
		.lean();

	// =========================
	// WALLET HISTORY (CurrencyHistory)
	// =========================
	const walletHistory = await CurrencyHistory.find({
		guildId,
		userId,
	})
		.sort({ createdAt: -1 })
		.limit(6)
		.lean();

	// =========================
	// POINT HISTORY (PointHistory)
	// =========================
	const pointHistory = await PointHistory.find({
		guildId,
		userId,
	})
		.sort({ createdAt: -1 })
		.limit(6)
		.lean();

	// =========================
	// DRIVER LINK
	// =========================
	const driverLink = await getDriverLink(guildId, userId);

	let trucky = null;

	if (driverLink) {
		const member = await getCompanyMemberByTruckyId(driverLink.truckyId);

		if (member) {
			trucky = {
				id: member.id,
				username: member.name,
				role: member.role?.name,
				distance: member.total_driven_distance_km,
				cargomass: member.total_cargo_mass_t,
				lastActivity: member.updated_at,
				inactive: member.role?.inactive,
			};
		}
	}

	return {
		userId,

		// 🔥 FIELD UNTUK PROFILE.JS
		wallet: userCurrency,
		walletHistory,

		penaltyPoint: userPoints,
		pointHistory,

		// tetap untuk profile overview
		totalJobs,
		specialJobs,
		canceledJobs,
		recentJobs,

		driverLink: driverLink
			? {
					truckyId: driverLink.truckyId,
					truckyName: driverLink.truckyName,
				}
			: null,

		trucky,
	};
}

module.exports = {
	getProfileData,
};
