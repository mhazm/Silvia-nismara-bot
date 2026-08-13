const mongoose = require('mongoose');

const cargoMarketHistorySchema = new mongoose.Schema(
	{
		cargo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cargo', required: true },
		in_game_id: { type: String, required: true },
		old_market_demand: { type: Number },
		new_market_demand: { type: Number },
		old_price: { type: Number },
		new_price: { type: Number },
	},
	{ timestamps: true },
);

// Hapus secara otomatis dari MongoDB setelah 3 hari (259200 detik)
cargoMarketHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 259200 });

module.exports = mongoose.models.CargoMarketHistory || mongoose.model('CargoMarketHistory', cargoMarketHistorySchema);
