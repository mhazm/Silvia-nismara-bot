// src/models/Registration.js
const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
	guildId: { type: String, required: true },
	userId: { type: String, required: true }, // Discord ID
	username: { type: String, required: true },
	truckyId: { type: String, required: true },
	reason: { type: String, required: true },
	game: { type: String, required: true },
	experience: { type: String, required: true },
	sumber: { type: String, required: true },
	status: { type: String, default: 'pending' }, // pending, approved, rejected
	channelId: { type: String }, // Akan diisi bot setelah ticket dibuat
	createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Registration', registrationSchema);
