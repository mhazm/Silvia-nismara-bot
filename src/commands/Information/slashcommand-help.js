const { ChatInputCommandInteraction } = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');

module.exports = new ApplicationCommand({
	command: {
		name: 'help',
		description: '📚 Menampilkan daftar semua command yang tersedia.',
		type: 1,
		options: [],
	},
	options: {
		cooldown: 10000,
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.reply({
			content: `${client.collection.application_commands.map((cmd) => '\`/' + cmd.command.name + '\`').join(', ')}`,
			ephemeral: true,
		});
	},
}).toJSON();
