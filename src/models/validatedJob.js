const mongoose = require("mongoose");

const validatedJobSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  jobId: { type: String, required: true, unique: true },
  distance: Number,
  deducted: Number
}, { timestamps: true });

module.exports =
  mongoose.models.ValidatedJob ||
  mongoose.model("ValidatedJob", validatedJobSchema);
