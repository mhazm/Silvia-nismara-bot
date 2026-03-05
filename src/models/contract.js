const mongoose = require('mongoose');


const contributorSchema = new mongoose.Schema(
	{
		driverId: { type: String, required: true },
		jobs: { type: Number, default: 0 },
		totalNC: { type: Number, default: 0 },
		totalDistance: { type: Number, default: 0 },
		totalMass: { type: Number, default: 0 },
	},
	{ _id: false }
);

const contractSchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		contractName: { type: String, required: true },
		companyName: { type: String },
		channelId: { type: String }, // optional channel ID for contract announcements
		imageUrl: { type: String }, // optional image URL for the company logo
		gameId: { type: String }, // optional game ID (e.g., '1 for ets2', '2 for ats')
		completedContracts: { type: Number, default: 0 },
		totalNCEarned: { type: Number, default: 0 },
		totalDistance: { type: Number, default: 0 }, // in kilometers
		totalMass: { type: Number, default: 0 }, // in tons
		setBy: { type: String }, // siapa yang set
		setAt: { type: Date, default: Date.now },
		endAt: { type: Date }, // optional end date for the contract

		// Leaderboard
		contributors: [contributorSchema],
	},
	{ timestamps: true },
);

contractSchema.index({ guildId: 1, gameId: 1 }, { unique: true }); // pastikan companyName unik per guild

module.exports =
	mongoose.models.Contract || mongoose.model('Contract', contractSchema);
