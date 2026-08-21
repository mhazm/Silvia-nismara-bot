const Event = require('../../structure/Event');

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			if (message.author.bot) return;

			// --- Natasya AI Service (Mention / DM) ---
			// Check if message is in DM (ChannelType.DM is 1) or if bot is mentioned
			if (message.channel.type === 1 || message.mentions.has(__client__.user)) {
				const { handleChat } = require('../../services/aiService');
				return handleChat(message);
			}
		} catch (error) {
			console.error('[AI MessageCreate] Error:', error);
		}
	},
}).toJSON();
