const mongoose = require('mongoose');

const fuelUsageHistorySchema = new mongoose.Schema(
	{
		discordId: { type: String, required: true },
		jobId: { type: String, default: null },
		source: { type: String, required: true },
		destination: { type: String, required: true },
		fuelConsumed: { type: Number, required: true },
		timestamp: { type: Date, default: Date.now, index: true },
	},
	{ timestamps: true },
);

module.exports = mongoose.model('FuelUsageHistory', fuelUsageHistorySchema);
