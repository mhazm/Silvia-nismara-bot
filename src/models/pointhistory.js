const mongoose = require('mongoose');

const pointHistorySchema = new mongoose.Schema({
	guildId: { type: String, required: true },
	userId: { type: String, required: true },
	managerId: { type: String, required: true },
	points: { type: Number, required: true },
	reason: { type: String, required: true },
	type: { type: String, enum: ['add', 'remove'], required: true },
	createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PointHistory', pointHistorySchema);
