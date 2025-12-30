const mongoose = require('mongoose');

const jobHistorySchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		jobId: { type: String, required: true },
		driverId: { type: String, required: true },
		truckyId: { type: String, required: true },

		// 🔐 Distributed Lock
		status: {
			type: String,
			enum: ['processing', 'completed', 'failed', 'idle'],
			default: 'idle',
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

		// Job info
		sourceCity: String,
		destinationCity: String,
		sourceCompany: String,
		destinationCompany: String,
		cargoName: String,
		cargoMass: Number,
		distanceKm: Number,
		durationSeconds: Number,
		revenue: Number,
		startedAt: Date,
		completedAt: Date,

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
			total: Number,
		},

		// Penalty
		penalty: {
			vehicle: Number,
			trailer: Number,
			cargo: Number,
			speed: Number,
			distance: Number,
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

module.exports = mongoose.model('JobHistory', jobHistorySchema);
