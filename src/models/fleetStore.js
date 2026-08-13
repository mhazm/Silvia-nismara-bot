const mongoose = require('mongoose');

const fleetStoreSchema = new mongoose.Schema(
	{
		id: { type: String, required: true },
		name: { type: String, required: true },
		game_id: { type: Number, required: true },
		in_game_id: { type: String },
		type: { type: String, enum: ['truck', 'bus'], required: true },
		price: { type: Number, required: true },
		photo_url: { type: String, required: true },
		brand: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'FleetBrand',
			required: true,
		},
		component_cost_maintenance: {
			engine: { type: Number, required: true, default: 1000 },
			tires: { type: Number, required: true, default: 500 },
			transmission: { type: Number, required: true, default: 2000 },
			brakes: { type: Number, required: true, default: 800 },
		},
		component_cost_unfix_wear: {
			engine: { type: Number, required: true, default: 40000 },
			transmission: { type: Number, required: true, default: 60000 },
			brakes: { type: Number, required: true, default: 40000 },
			tires: { type: Number, required: true, default: 30000 },
		},
	},
	{ timestamps: true },
);

module.exports =
	mongoose.models.FleetStore ||
	mongoose.model('FleetStore', fleetStoreSchema);
