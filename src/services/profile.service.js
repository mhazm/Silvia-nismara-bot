const JobHistory = require('../models/jobHistory');
const Currency = require('../models/currency');
const Point = require('../models/points');
const { getDriverLink } = require('./driverLink.service');
const { getCompanyMemberByTruckyId } = require('./trucky.service');

async function getProfileData(guildId, userId) {

    const currency = await Currency.findOne({ guildId, userId }).lean();
    if (!currency) {
        return null;
    }

    const userCurrency = currency.totalNC || 0;

    const point = await Point.findOne({ guildId, userId }).lean();
    if (!point) {
        return null;
    }

    const userPoints = point.totalPoints || 0;

	const [totalJobs, specialJobs, canceledJobs] = await Promise.all([
		JobHistory.countDocuments({ guildId, driverId:userId }),
		JobHistory.countDocuments({ guildId, driverId:userId, isSpecialContract: 'true' }),
		JobHistory.countDocuments({ guildId, driverId:userId, jobStatus: 'CANCELED' }),
	]);

	const recentJobs = await JobHistory.find({ guildId, driverId:userId })
		.sort({ createdAt: -1 })
		.limit(5)
		.select('jobId status createdAt')
		.lean();

	// 🔹 DriverLink lookup
	const driverLink = await getDriverLink(guildId, userId);

	let trucky = null;

	if (driverLink) {
		const member = await getCompanyMemberByTruckyId(
			driverLink.truckyId
		);

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
		currency: userCurrency,
		penaltyPoints: userPoints,
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