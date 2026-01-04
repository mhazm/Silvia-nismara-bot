const mongoose = require("mongoose");

const ncEventHistorySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  multiplier: { type: Number, default: 1 },
  nameEvent: { type: String, required: true },
  imageUrl: { type: String },
  setBy: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  durationDays: { type: Number }, // event berakhir kapan
}, { timestamps: true });

module.exports =
  mongoose.models.NCEventHistory ||
  mongoose.model("NCEventHistory", ncEventHistorySchema);