const Event = require('../../structure/Event');

module.exports = new Event({
	event: 'interactionCreate',
	run: async (__client__, interaction) => {
		if (!interaction.isButton()) return;
		if (interaction.customId !== 'cancel_accept_driver') return;

		await interaction.update({
			content: '❎ Proses pengangkatan driver dibatalkan.',
			components: [],
		});
	},
}).toJSON();
