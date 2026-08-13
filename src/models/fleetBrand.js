const mongoose = require('mongoose');

const fleetBrandSchema = new mongoose.Schema(
	{
		id: { type: String, required: true },
		name: { type: String, required: true },
		logo_url: { type: String, required: false },
	},
	{ timestamps: true },
);

module.exports = mongoose.models.FleetBrand || mongoose.model('FleetBrand', fleetBrandSchema);
