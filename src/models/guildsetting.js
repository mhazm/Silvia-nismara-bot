const mongoose = require('mongoose');

const guildSettingsSchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true, unique: true },
		channelLog: { type: String },
		truckyWebhookChannel: { type: String, default: null },
		contractChannel: { type: String, default: null },

		// Role-role khusus untuk perintah
		roles: {
			manager: [String],
			moderator: [String],
			driver: [String],
		},
	},
	{ timestamps: true },
);

module.exports =
  mongoose.models.GuildSettings ||
  mongoose.model("GuildSettings", guildSettingsSchema);