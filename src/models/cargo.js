const mongoose = require('mongoose');

const cargoSchema = new mongoose.Schema(
	{
		id: { type: String, required: true },
		name: { type: String, requred: true },
		in_game_id: { type: String, required: true },
		game_id: { type: Number, required: true },
		adr_class: { type: Number },
		fragility: { type: Number },
		mass: { type: Number },
		volume: { type: Number },
		unit_reward_per_km: { type: Number },
		overweight: { type: Boolean, default: false },
		groups: Array,
		body_types: Array,
		valuable: { type: Boolean, default: false },
		market_demand: { type: Number, default: 0 },
		difference: { type: Number, default: 0 },
		enabled: { type: Boolean, default: true },
		job_count: { type: Number, default: 0 },
		price_per_km: { type: Number },
		price_per_km_with_market_change: { type: Number },
		is_fragile: { type: Boolean, default: false },
	},
	{ timestamps: true },
);

module.exports = mongoose.models.Cargo || mongoose.model('Cargo', cargoSchema);
