const mongoose = require("mongoose");

const specialContractHistorySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  driverId: { type: String, required: true },  // Discord ID
  jobId: { type: String, required: true },

  // Informasi job
  source: { type: String },
  destination: { type: String },
  distanceKm: { type: Number, default: 0 },
  cargoName: { type: String },
  cargoMass: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },

  completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index yang sering dipakai query
specialContractHistorySchema.index({ guildId: 1, driverId: 1 });

module.exports =
  mongoose.models.SpecialContractHistory ||
  mongoose.model("SpecialContractHistory", specialContractHistorySchema);
