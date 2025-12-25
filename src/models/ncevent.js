const mongoose = require("mongoose");

const ncEventSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  multiplier: { type: Number, default: 1 },
  endAt: { type: Date }, // event berakhir kapan
}, { timestamps: true });

module.exports =
  mongoose.models.NCEvent ||
  mongoose.model("NCEvent", ncEventSchema);