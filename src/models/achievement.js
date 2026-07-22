const { Schema, model } = require('mongoose');

const achievementSchema = new Schema(
	{
		// Kode unik untuk mempermudah pencarian dari webhook (misal: "HW_RUNNER", "EVENT_MERDEKA")
		codeId: { type: String, required: true, unique: true },
		name: { type: String, required: true },
		description: { type: String, default: 'Belum ada deskripsi.' },
		imageUrl: { type: String, default: null },

		category: {
			type: String,
			enum: ['weekly', 'monthly', 'event', 'onetime'],
			required: true,
		},
	},
	{ timestamps: true },
);

module.exports = model('Achievement', achievementSchema);
