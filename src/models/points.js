const mongoose = require("mongoose");

const pointSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  totalPoints: { type: Number, default: 0 },
});

module.exports = mongoose.model("Point", pointSchema);