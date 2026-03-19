const mongoose = require('mongoose');

const couponClaimedSchema = new mongoose.Schema(
    {
        driverId: { type: String, required: true },
        ncAmount: { type: Number, default: 0 },
        claimedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const couponHistorySchema = new mongoose.Schema(
    {
        guildId: { type: String, required: true },
        nameCoupon: { type: String, required: true },
        codeCoupon: { type: String, required: true },
        minAmount: { type: Number, default: 0 }, // minimum amount to use the coupon
        maxAmount: { type: Number, default: 0 }, // maximum discount amount
        totalNcClaimed: { type: Number, default: 0 }, // total NC yang sudah diklaim dari kupon ini
        imageUrl: { type: String }, // optional image URL for the coupon
        validUntil: { type: Date }, // optional expiration date for the coupon
        setBy: { type: String }, // siapa yang set
        setAt: { type: Date, default: Date.now },

        startDate: { type: Date },
		endDate: { type: Date },
		closedAt: { type: Date, default: Date.now },
		durationDays: Number,

        driverClaims: [couponClaimedSchema], // array untuk menyimpan klaim driver
    },
    { timestamps: true },
);

module.exports =
    mongoose.models.CouponHistory || mongoose.model('CouponHistory', couponHistorySchema);