const mongoose = require("mongoose");

const currencySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  
  totalNC: { type: Number, default: 0 },

}, { timestamps: true });

module.exports =
  mongoose.models.Currency ||
  mongoose.model("Currency", currencySchema);
