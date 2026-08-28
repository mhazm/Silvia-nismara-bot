const mongoose = require('mongoose');

const jobHistorySchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		jobId: { type: String, required: true },
		driverId: { type: String, required: true },
		truckyId: { type: String, required: true },
		gameId: { type: String },

		// 🔐 Distributed Lock
		status: {
			type: String,
			enum: ['processing', 'completed', 'failed', 'ongoing'],
			default: 'ongoing',
			index: true,
		},
		lockId: { type: String },
		lockedAt: { type: Date },

		jobStatus: {
			type: String,
			enum: ['ONGOING', 'COMPLETED', 'CANCELED', 'TIMEOUT'],
			default: 'ONGOING',
			index: true,
		},

		// Game info
		game: String, // ETS2 / ATS
		gameMode: String, // truckersmp / sp
		statsType: String,
		marketType: String, // cargo market / freight market

		// Job info
		sourceCity: String,
		destinationCity: String,
		sourceCompany: String,
		destinationCompany: String,
		cargoId: String,
		cargoName: String,
		cargoMass: Number,
		plannedDistanceKm: Number,
		distanceKm: Number,
		durationSeconds: Number,
		revenue: Number,
		startedAt: Date,
		completedAt: Date,

		// Locked Price
		lockedCargoPrice: { type: Number },

		// vehicle info
		vehicle: {
			brand: String,
			model: String,
		},

		vehicleStatus: {
			type: String,
			enum: ['Owned', 'Rental', 'Company'],
		},

		// Data armada perusahaan (jika menggunakan Company Fleet)
		fleet_data: {
			fleet_id: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Fleet',
				default: null,
			}, // Referensi ke database Fleet
			fleet_number: { type: String, default: null }, // Nomor lambung (e.g., "01")
			fleet_name: { type: String, default: null }, // Nama armada (e.g., "Scania S")
			in_game_id: { type: String, default: null }, // Trucky in_game_id
		},

		vehicleId: { type: String, default: null },
		vehicleRentCost: { type: Number, default: 0 },
		rentPricePerKm: { type: Number, default: 0 },
		marketFuelPricePerL: { type: Number, default: 0 },

		// hardcore
		isHardcore: { type: Boolean, default: false },
		hardcoreRating: { type: Number, default: 0 },

		// Damage
		damage: {
			vehicle: Number,
			trailer: Number,
			cargo: Number,
		},

		// Reward
		nc: {
			base: Number,
			special: Number,
			hardcore: Number,
			event: Number,
			booster: Number,
			nismaraplus: Number,
			truckersmp: Number,
			total: Number,
		},

		ncCost: {
			rent: Number,
			service: Number,
			fuel: Number,
			fines: Number,
			total: Number,
		},

		tax: {
			rate: Number,
			amount: Number,
		},

		fines_events: [
			{
				offenceName: String,
				amount: Number,
			},
		],

		discount: {
			nismaraplus: { type: Number, default: 0 },
			insurance: { type: Number, default: 0 },
			total: { type: Number, default: 0 },
		},

		maintenance_penalty: { type: Number, default: 0 },

		// Penalty
		penalty: {
			vehicle: Number,
			trailer: Number,
			cargo: Number,
			speed: Number,
			distance: Number,
			total: Number,
		},

		xp: {
			base: Number,
			special: Number,
			hardcore: Number,
			event: Number,
			booster: Number,
			nismaraplus: Number,
			total: Number,
		},

		isSpecialContract: { type: Boolean, default: false },
		cancelPenaltyApplied: {
			type: Boolean,
			default: false,
			index: true,
		},

		error: String,
	},
	{
		timestamps: true, // createdAt, updatedAt
	},
);

// 🔒 Anti duplikasi
jobHistorySchema.index({ guildId: 1, jobId: 1 }, { unique: true });

module.exports =
	mongoose.models.JobHistory ||
	mongoose.model('JobHistory', jobHistorySchema);
