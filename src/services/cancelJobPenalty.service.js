const Point = require('../models/points');
const PointHistory = require('../models/pointhistory');

async function applyCancelPenalty({ guildId, userId, jobId, managerId }) {
	const PENALTY_POINTS = 5;

	await Point.findOneAndUpdate(
		{ guildId, userId },
		{ $inc: { totalPoints: PENALTY_POINTS } },
		{ upsert: true }
	);

	await PointHistory.create({
		guildId,
		userId,
		managerId,
		points: PENALTY_POINTS,
		type: 'add',
		reason: `Job abandoned (Start new job before finishing) — Job #${jobId}`,
	});
}

module.exports = {
	applyCancelPenalty,
};
