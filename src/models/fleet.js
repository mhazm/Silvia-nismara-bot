const mongoose = require('mongoose');

const fleetSchema = new mongoose.Schema(
	{
		id: { type: String, required: true },
		fleet_name: { type: String, required: true },
		game_id: { type: String, required: true },
		fleet_number: { type: String, required: true },
		driver: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		model: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'FleetStore',
			required: true,
		},
		odometer: { type: Number, required: true },
		wheels: { type: String, enum: ['4x2', '4x6', '4x8'] },
		used_price: { type: Number, default: null },
		status: {
			type: String,
			enum: ['active', 'inactive', 'onservice', 'need_maintenance'],
			default: 'active',
		},
		has_insurance: { type: Boolean, default: false },
		jobs_count: { type: Number, default: 0 },
		jobs_in_progress_count: { type: Number, default: 0 },
		total_damage_cost: { type: Number, default: 0 },
		total_fuel_used: { type: Number, default: 0 },
		total_fuel_cost: { type: Number, default: 0 },
		total_revenue: { type: Number, default: 0 },
		maintenance_needed: { type: Boolean, default: false },
		maintenance_start_date: { type: Date, default: null },
		maintenance_end_date: { type: Date, default: null },
		maintenance: {
			engine: { type: Number, default: 45000 },
			tires: { type: Number, default: 20000 },
			transmission: { type: Number, default: 60000 },
			brakes: { type: Number, default: 35000 },
		},
		wear: {
			unfix_engine: { type: Number, default: 0 },
			unfix_transmission: { type: Number, default: 0 },
			unfix_brakes: { type: Number, default: 0 },
			unfix_tires: { type: Number, default: 0 },
		},
		last_maintenance: {
			engine: { type: Number, default: 0 },
			tires: { type: Number, default: 0 },
			transmission: { type: Number, default: 0 },
			brakes: { type: Number, default: 0 },
		},
	},
	{ timestamps: true },
);

module.exports = mongoose.models.Fleet || mongoose.model('Fleet', fleetSchema);
