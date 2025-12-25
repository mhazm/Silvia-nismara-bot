const mongoose = require("mongoose");

const currencyHistorySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  managerId: { type: String, required: true },
  type: { type: String, enum: ["earn", "spend"], default: "earn" },
  reason: { type: String, default: "Job Reward" },
}, { timestamps: true });

module.exports =
  mongoose.models.CurrencyHistory ||
  mongoose.model("CurrencyHistory", currencyHistorySchema);
