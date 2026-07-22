const partisipanSchema = new mongoose.Schema(
	{
		truckyId: String,
		discordId: String,
		jobs: Number,
	},
	{ _id: false },
);

const convoyLobbySchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		gameId: { type: String, required: true },
		convoyUri: { type: String, required: true },
		convoyName: { type: String, required: true },
		description: { type: String, required: true },
		password: { type: String, required: true },
		active: { type: Boolean, default: true },
		setBy: String,
        typeConvoy: { type: String, enum: ['Mingguan', 'Bulanan'], default: 'Mingguan' },

		startDate: { type: Date },
		meetupDate: { type: Date },

		sourceCity: String,
		destinationCity: String,
		sourceCompany: String,
		destinationCompany: String,
		cargoName: String,
		cargoMass: Number,
		plannedDistanceKm: Number,

		partisipan: [partisipanSchema],
	},
	{ timestamps: true },
);

module.exports =
	mongoose.models.ConvoyLobby ||
	mongoose.model('ConvoyLobby', convoyLobbySchema);
