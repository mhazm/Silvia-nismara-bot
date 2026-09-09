const mongoose = require('mongoose');

/**
 * @typedef {Object} GiveawayRewardItem
 * @property {"NC" | "FUEL" | "SAFEBOX_TICKET" | "VOUCHER" | "NPLUS_TRIAL" | "MOD_LIVERY" | "CUSTOM"} type
 * @property {string} title
 * @property {string} [description]
 * @property {number} [amount]
 * @property {"FLEET_MAINTENANCE" | "FLEET_BUY" | "NC_BOOSTER" | "MARKET_MOD" | "GARAGE_UPGRADE"} [voucherCategory]
 * @property {"percentage" | "fixed"} [voucherDiscountType]
 * @property {number} [voucherDiscountValue]
 * @property {number} [voucherDurationHours]
 * @property {string} [imageUrl]
 */

/**
 * @typedef {Object} GiveawayPrizeTier
 * @property {number} tier
 * @property {string} tierTitle
 * @property {number} winnerCount
 * @property {GiveawayRewardItem[]} rewards
 */

/**
 * @typedef {Object} GiveawayQuestConfig
 * @property {string} questId
 * @property {string} title
 * @property {string} description
 * @property {"TOTAL_JOBS" | "LONG_HAUL" | "TRUCKERSMP_JOB" | "HEAVY_CARGO" | "PERFECT_DELIVERY"} type
 * @property {number} target
 * @property {number} [minDistanceKm]
 * @property {number} [minCargoMass]
 * @property {number} rewardTickets
 */

/**
 * @typedef {Object} GiveawayWinner
 * @property {number} tier
 * @property {string} tierTitle
 * @property {string} discordId
 * @property {string} name
 * @property {string} [avatarUrl]
 * @property {string} ticketNumber
 * @property {GiveawayRewardItem[]} rewards
 * @property {Date} drawnAt
 */

const rewardItemSchema = new mongoose.Schema(
	{
		type: {
			type: String,
			enum: ['NC', 'FUEL', 'SAFEBOX_TICKET', 'VOUCHER', 'NPLUS_TRIAL', 'MOD_LIVERY', 'CUSTOM'],
			required: true,
		},
		title: { type: String, required: true },
		description: { type: String, default: '' },
		amount: { type: Number, default: 0 },
		voucherCategory: { type: String, default: null },
		voucherDiscountType: { type: String, default: null },
		voucherDiscountValue: { type: Number, default: 0 },
		voucherDurationHours: { type: Number, default: 0 },
		imageUrl: { type: String, default: null },
	},
	{ _id: false },
);

const prizeTierSchema = new mongoose.Schema(
	{
		tier: { type: Number, required: true },
		tierTitle: { type: String, required: true },
		winnerCount: { type: Number, required: true, default: 1 },
		rewards: [rewardItemSchema],
	},
	{ _id: false },
);

const questConfigSchema = new mongoose.Schema(
	{
		questId: { type: String, required: true },
		title: { type: String, required: true },
		description: { type: String, default: '' },
		type: {
			type: String,
			enum: ['TOTAL_JOBS', 'LONG_HAUL', 'TRUCKERSMP_JOB', 'HEAVY_CARGO', 'PERFECT_DELIVERY'],
			required: true,
		},
		target: { type: Number, required: true, default: 1 },
		minDistanceKm: { type: Number, default: null },
		minCargoMass: { type: Number, default: null },
		rewardTickets: { type: Number, required: true, default: 1 },
	},
	{ _id: false },
);

const winnerSchema = new mongoose.Schema(
	{
		tier: { type: Number, required: true },
		tierTitle: { type: String, required: true },
		discordId: { type: String, required: true },
		name: { type: String, required: true },
		avatarUrl: { type: String, default: null },
		ticketNumber: { type: String, required: true },
		rewards: [rewardItemSchema],
		drawnAt: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const giveawaySchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		slug: { type: String, required: true, unique: true, index: true },
		description: { type: String, default: '' },
		bannerUrl: { type: String, default: null },
		startDate: { type: Date, required: true, index: true },
		endDate: { type: Date, required: true, index: true },
		drawDate: { type: Date, default: null },
		status: {
			type: String,
			enum: ['draft', 'scheduled', 'ongoing', 'drawing', 'completed', 'cancelled'],
			default: 'draft',
			index: true,
		},
		allowMultipleWins: { type: Boolean, default: false },
		enableQuests: { type: Boolean, default: true },
		quests: [questConfigSchema],
		enableNcPurchase: { type: Boolean, default: true },
		ticketPriceNC: { type: Number, default: 1000 },
		maxPurchasableTickets: { type: Number, default: 5 },
		discountNPlusAndBooster: { type: Number, default: 20 },
		prizes: [prizeTierSchema],
		winners: [winnerSchema],
		stats: {
			totalTickets: { type: Number, default: 0 },
			totalParticipants: { type: Number, default: 0 },
			totalNcBurned: { type: Number, default: 0 },
		},
		createdBy: { type: String, default: null },
	},
	{ timestamps: true },
);

module.exports =
	mongoose.models.Giveaway || mongoose.model('Giveaway', giveawaySchema);
