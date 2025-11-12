const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  channelId: { type: String }, // optional channel ID for contract announcements
  imageUrl: { type: String }, // optional image URL for the company logo
  setBy: { type: String }, // siapa yang set
  setAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Contract", contractSchema);
