const mongoose = require("mongoose");

const activeJobSchema = new mongoose.Schema({
  guildId: String,
  driverId: String,
  jobId: String,
  companyName: String,
  source: String,
  destination: String,
  cargo: String,
  startedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model("ActiveJob", activeJobSchema);
