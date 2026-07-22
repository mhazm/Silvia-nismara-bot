const mongoose = require('mongoose');

const flightDataSchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		jobId: { type: String, required: true },
		discordId: { type: String, required: true },
		pilotId: { type: String, required: true },

		// Aircraft Info
		aircraft: new mongoose.Schema(
			{
				icao: String,
				icao_name: String,
				name: String,
				type: String,
				user_conf: {
					tail: { type: String, default: null },
					icao: { type: String, default: null },
				},
			},
			{ _id: false },
		),

		plan: {
			callsign: String,
			cruise_level: String,
			route: String,
		},

		fuel_used: Number,
		landing_rate: Number,

		distance: {
			nm: Number,
			km: Number,
		},

		average: {
			spd: Number,
		},

		max: {
			alt: Number,
			spd: Number,
		},

		time: Number,

		departure: {
			icao: String,
			iata: String,
			name: String,
			time: Date,
			geo: {
				lat: String,
				lng: String,
			},
			hdg: {
				mag: Number,
				true: Number,
			},
			spd: {
				tas: Number,
			},
			fuel: Number,
			pitch: Number,
			bank: Number,
			wind: {
				spd: Number,
				dir: Number,
			},
		},

		arrival: {
			icao: String,
			iata: String,
			name: String,
			time: Date,
			geo: {
				lat: String,
				lng: String,
			},
			hdg: {
				mag: Number,
				true: Number,
			},
			spd: {
				tas: Number,
			},
			fuel: Number,
			pitch: Number,
			bank: Number,
			wind: {
				spd: Number,
				dir: Number,
			},
		},

		// Reward
		nc: {
			base: Number,
			special: Number,
			hardcore: Number,
			event: Number,
			booster: Number,
			total: Number,
		},

		ncCost: {
			rent: Number,
			service: Number,
			fuel: Number,
			total: Number,
		},

		// Penalty
		penalty: {
			landingRate: Number,
			total: Number,
		},

		isSpecialContract: { type: Boolean, default: false },

		error: String,
	},
	{
		timestamps: true, // createdAt, updatedAt
	},
);

// 🔒 Anti duplikasi
flightDataSchema.index({ guildId: 1, jobId: 1 }, { unique: true });

module.exports =
	mongoose.models.FlightData ||
	mongoose.model('FlightData', flightDataSchema);
