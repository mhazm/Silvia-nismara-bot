// src/models/Users.js
const mongoose = require('mongoose');

const usersSchema = new mongoose.Schema({
	id: { type: String, required: true },
	name: { type: String, required: true },
	discordId: { type: String, required: true }, // Discord ID
	isDriver: { type: Boolean, default: false },
	isOnLeave: { type: Boolean, default: false },
	truckyId: { type: String, required: false },
	xp: { type: Number, default: 0 },
	level: { type: Number, default: 1 },
	isBooster: { type: Boolean, default: false },
	isBestEmployeeETS2: { type: Boolean, default: false },
	isBestEmployeeATS: { type: Boolean, default: false },
	truckyRole: { type: String, default: null },

	insurance: {
		status: { type: Boolean, default: false },
		rating: { type: Number, default: 100 },
		startedAt: { type: Date, default: null },
		expiredAt: { type: Date, default: null },
	},

	nismaraplus: {
		status: { type: Boolean, default: false },
		startedAt: { type: Date, default: null },
		expiredAt: { type: Date, default: null },
	},

	galleryBan: {
		status: { type: Boolean, default: false },
		expiredAt: { type: Date, default: null },
		reason: { type: String, default: null },
	},

	social_media: {
		youtube: { type: String, default: null },
		facebook: { type: String, default: null },
		instagram: { type: String, default: null },
		twitter: { type: String, default: null },
		tiktok: { type: String, default: null },
		world_of_truck: { type: String, default: null },
		website: { type: String, default: null },
	},
});

module.exports = mongoose.model('Users', usersSchema);
