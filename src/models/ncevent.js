const mongoose = require('mongoose');

const ncEventSchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		slug: { type: String, unique: true, required: true },
		nameEvent: { type: String, required: true },
		multiplier: { type: Number, default: 1 },
		imageUrl: { type: String },
		type: {
			type: String,
			enum: ['Singleplayer', 'TruckersMP', 'all'],
			default: 'all',
		},
		gameId: { type: String, enum: ['1', '2', 'all'], default: 'all' },
		participants: [
			{
				discordId: { type: String, required: true },
				totalEarned: { type: Number, default: 0 },
				joinedAt: { type: Date, default: Date.now },
			},
		],
		isActive: { type: Boolean, default: true },
		setBy: { type: String, required: true },
		setAt: { type: Date, default: Date.now },
		endAt: { type: Date }, // event berakhir kapan
	},
	{ timestamps: true },
);

module.exports =
	mongoose.models.NCEvent || mongoose.model('NCEvent', ncEventSchema);
