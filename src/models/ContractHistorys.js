const mongoose = require('mongoose');

const contractHistorysSchema = new mongoose.Schema({
	guildId: { type: String, required: true },
	companyName: { type: String, required: true },
	imageUrl: { type: String },
	setBy: { type: String },
	startDate: { type: Date, default: Date.now },
	endDate: { type: Date },
	durationDays: { type: Number },
});

module.exports =
  mongoose.models.ContractHistorys ||
  mongoose.model("ContractHistorys", contractHistorysSchema);
