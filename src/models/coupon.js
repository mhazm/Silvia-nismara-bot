const mongoose = require('mongoose');

const couponClaimedSchema = new mongoose.Schema(
	{
		discordId: { type: String }, // Discord ID user
		driverId: { type: String, required: true }, // Trucky ID atau Discord ID fallback
		amount: { type: Number, default: 0 }, // Jumlah NC atau Tiket yang didapatkan
		claimedAt: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const couponSchema = new mongoose.Schema(
	{
		guildId: { type: String, required: true },
		nameCoupon: { type: String, required: true },
		codeCoupon: { type: String, required: true },
		type: { type: String, enum: ['NC', 'PENALTY_TICKET'], default: 'NC' },
		minAmount: { type: Number, default: 0 }, // minimum amount
		maxAmount: { type: Number, default: 0 }, // maximum amount
		totalNcClaimed: { type: Number, default: 0 }, // total reward yang sudah diklaim
		imageUrl: { type: String, default: null }, // optional image URL
		startDate: { type: Date, default: Date.now }, // kapan kupon dimulai
		endDate: { type: Date }, // expiration date for the coupon
		durationDays: { type: Number }, // durasi kupon
		isActive: { type: Boolean, default: true }, // status aktif kupon
		setBy: { type: String }, // siapa yang set
		driverClaims: [couponClaimedSchema], // array untuk menyimpan klaim driver
	},
	{ timestamps: true },
);

module.exports =
	mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
