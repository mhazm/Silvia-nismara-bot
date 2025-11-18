const mongoose = require("mongoose");

const guildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelLog : { type: String },

  // Role-role khusus untuk perintah
  roles: {
    manager: [String],
    moderator: [String],
    driver: [String],
  },
}, { timestamps: true });

module.exports = mongoose.model("GuildSettings", guildSettingsSchema);