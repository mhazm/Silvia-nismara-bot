const mongoose = require('mongoose');

const contributorSchema = new mongoose.Schema(
	{
		driverId: String,
		jobs: Number,
		totalNC: Number,
		totalDistance: Number,
		totalMass: Number,
	},
	{ _id: false }
);

const contractHistorySchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		gameId: { type: String, required: true },

		contractName: { type: String, required: true },
		companyName: { type: String, required: true },
		setBy: String,

		startDate: { type: Date },
		endDate: { type: Date },
		closedAt: { type: Date, default: Date.now },
		durationDays: Number,

		completedContracts: { type: Number, default: 0 },
		totalNCEarned: { type: Number, default: 0 },
		totalDistance: { type: Number, default: 0 },
		totalMass: { type: Number, default: 0 },

		contributors: [contributorSchema],
	},
	{ timestamps: true }
);

module.exports =
  mongoose.models.ContractHistory ||
  mongoose.model("ContractHistory", contractHistorySchema);