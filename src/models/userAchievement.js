const { Schema, model } = require('mongoose');

const userAchievementSchema = new Schema(
	{
		discordId: { type: String, required: true },
		truckyId: { type: String, required: true },
		// Relasi ke tabel Master Achievement
		achievementId: {
			type: Schema.Types.ObjectId,
			ref: 'Achievement',
			required: true,
		},
		// Catatan tambahan (Opsional, misal: "Minggu ke-2 Juli 2026")
		remarks: { type: String, default: null },
	},
	{
		timestamps: true,
	},
);

module.exports = model('UserAchievement', userAchievementSchema);
