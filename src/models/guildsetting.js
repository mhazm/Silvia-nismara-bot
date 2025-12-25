const mongoose = require('mongoose');

const guildSettingsSchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true, unique: true },
		channelLog: { type: String },
		truckyWebhookChannel: { type: String, default: null },
		contractChannel: { type: String, default: null },
		eventNotifyChannel: { type: String, default: null },
		memberWatcherChannel: { type: String, default: null },
		pointPrice: { type: Number, default: 3000 },

		// Role-role khusus untuk perintah
		roles: {
			manager: [String],
			moderator: [String],
			driver: [String],
			magang: [String],
		},
	},
	{ timestamps: true },
);

module.exports =
  mongoose.models.GuildSettings ||
  mongoose.model("GuildSettings", guildSettingsSchema);