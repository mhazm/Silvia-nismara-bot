const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
	guildId: { type: String, required: true },
	companyName: { type: String, required: true },
	channelId: { type: String }, // optional channel ID for contract announcements
	imageUrl: { type: String }, // optional image URL for the company logo
	gameId : { type: String }, // optional game ID (e.g., '1 for ets2', '2 for ats')
	setBy: { type: String }, // siapa yang set
	setAt: { type: Date, default: Date.now },
	endAt: { type: Date }, // optional end date for the contract
}, { timestamps: true });

contractSchema.index({ guildId: 1, gameId: 1 }, { unique: true }); // pastikan companyName unik per guild

module.exports =
  mongoose.models.Contract ||
  mongoose.model("Contract", contractSchema);
