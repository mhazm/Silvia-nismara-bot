const JobHistory = require('../models/jobHistory');
const PointHistory = require('../models/pointhistory');
const Point = require('../models/points');

async function evaluateDriver({
	guildId,
	userId,
	rangeDays = null, // optional
}) {
	const query = {
		guildId,
		driverId: userId,
	};

	if (rangeDays) {
		query.createdAt = {
			$gte: new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000),
		};
	}

	const jobs = await JobHistory.find(query);

	let completed = 0;
	let canceled = 0;
	let totalNC = 0;

	const ncBreakdown = { base: 0, special: 0, hardcore: 0, event: 0 };

	for (const job of jobs) {
		if (job.jobStatus === 'COMPLETED') {
			completed++;
			totalNC += Number(job.nc?.total || 0);
			ncBreakdown.base += job.nc.base || 0;
			ncBreakdown.special += job.nc.special || 0;
			ncBreakdown.hardcore += job.nc.hardcore || 0;
			ncBreakdown.event += job.nc.event || 0;
		}
		if (job.jobStatus === 'CANCELED') {
			canceled++;
		}
	}

	const totalJobs = completed + canceled;
	const completionRate =
		totalJobs === 0 ? 100 : Math.round((completed / totalJobs) * 100);


    const point = await Point.findOne({ guildId, userId }).lean();
    const totalPenalty = point.totalPoints || 0;

	// Status
	let status = 'EXCELLENT';
	if (completionRate < 80) status = 'GOOD';
	if (completionRate < 60) status = 'WARNING';
	if (completionRate < 30) status = 'POOR';

	return {
		userId,
		totalJobs,
		completed,
		canceled,
		completionRate,
		totalNC,
		totalPenalty,
		status,
	};
}

module.exports = {
	evaluateDriver,
};
