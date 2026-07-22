const mongoose = require('mongoose');

const pilotDataSchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		userId: { type: String, required: true }, // Discord user
		pilotId: { type: Number, required: true }, // Trucky User ID
		pilotName: { type: String, required: true },
		previousUserIds: {
			type: [String],
			default: [],
		},
	},
	{ timestamps: true },
);

pilotDataSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports =
	mongoose.models.PilotData || mongoose.model('PilotData', pilotDataSchema);
