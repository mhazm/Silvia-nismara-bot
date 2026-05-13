// src/models/Users.js
const mongoose = require('mongoose');

const usersSchema = new mongoose.Schema({
    id: { type: String, required: true },
    discordId: { type: String, required: true }, // Discord ID
    role: { type: String },
    isDriver: { type: Boolean },
    truckyId: { type: String, required: true },
    xp: { type: Number },
    level: { type: Number },
});

module.exports = mongoose.model('Users', usersSchema);
