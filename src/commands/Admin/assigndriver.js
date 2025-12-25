const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const assignDriver = require('../../utils/assignDriver');

module.exports = new ApplicationCommand({
	command: {
		name: 'assigndriver',
		description: 'Mengangkat user magang menjadi driver',
		options: [
			{
				name: 'user',
				description: 'User yang akan diangkat menjadi driver',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	options: {
		allowedRoles: ['manager'],
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		const member = interaction.options.getMember('user');
		if (!member) {
			return interaction.reply({
				content: '❌ User tidak ditemukan.',
				ephemeral: true,
			});
		}

		try {
			await assignDriver({
				client,
				guild: interaction.guild,
				executor: interaction.user,
				targetMember: member,
			});

			await interaction.reply({
				content: `✅ <@${member.id}> berhasil diangkat menjadi Driver.`,
				ephemeral: true,
			});
		} catch (err) {
			await interaction.reply({
				content: `❌ ${err.message}`,
				ephemeral: true,
			});
		}
	},
}).toJSON();
