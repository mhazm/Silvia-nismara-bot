// src/models/Users.js
const mongoose = require('mongoose');

const usersSchema = new mongoose.Schema({
	id: { type: String, required: true },
	name: { type: String, required: true },
	discordId: { type: String, required: true }, // Discord ID
	isDriver: { type: Boolean },
	isOnLeave: { type: Boolean },
	truckyId: { type: String, required: true },
	xp: { type: Number },
	level: { type: Number },

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
		notified3d: { type: Boolean, default: false },
	},
});

module.exports = mongoose.model('Users', usersSchema);
