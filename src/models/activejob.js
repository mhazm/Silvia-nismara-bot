const mongoose = require('mongoose');

const activeJobSchema = new mongoose.Schema({
	guildId: {type: String },
	driverId: {type: String },
	jobId: { type: String, },
	companyName: String,
	desinationCompany: String,
	source: String,
	destination: String,
	cargo: String,
	startedAt: { type: Date, default: Date.now },
	active: { type: Boolean, default: true },
});

module.exports =
  mongoose.models.ActiveJob ||
  mongoose.model("ActiveJob", activeJobSchema);
