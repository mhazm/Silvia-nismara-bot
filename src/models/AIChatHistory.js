const mongoose = require('mongoose');

const aiChatHistorySchema = new mongoose.Schema({
    discordId: { type: String, required: true, index: true },
    discordName: { type: String },
    history: { type: Array, default: [] },
    lastUpdatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AIChatHistory', aiChatHistorySchema);
