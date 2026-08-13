const mongoose = require('mongoose');

const insuranceClaimHistorySchema = new mongoose.Schema({
	guildId: { type: String, required: true },
	discordId: { type: String, required: true },
	truckyId: { type: String, required: true },
	jobId: { type: String, required: true },
	realCost: { type: Number, required: true },
	claimAmount: { type: Number, required: true },
	claimReason: { type: String, required: true },
	createdAt: { type: Date, default: Date.now },
});

module.exports =
	mongoose.models.InsuranceClaimHistory ||
	mongoose.model('InsuranceClaimHistory', insuranceClaimHistorySchema);
