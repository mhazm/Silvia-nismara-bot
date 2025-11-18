const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'rolelist',
		description: 'Melihat daftar role yang ada untuk server ini',
	},
	options: {
		botDevelopers: true,
		allowedRoles: ['manager'],
		cooldown: 10000, // 10 detik
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		try {
			const settings = await GuildSettings.findOne({
				guildId: interaction.guild.id,
			});

			if (!settings)
				return interaction.reply('❌ Belum ada role yang diatur.');

			const embed = new EmbedBuilder()
				.setTitle('📜 Daftar Role Terdaftar')
				.addFields(
					{
						name: 'Manager',
						value:
							settings.roles.manager
								?.map((r) => `<@&${r}>`)
								.join(', ') || '–',
					},
					{
						name: 'Moderator',
						value:
							settings.roles.moderator
								?.map((r) => `<@&${r}>`)
								.join(', ') || '–',
					},
					{
						name: 'Driver',
						value:
							settings.roles.driver
								?.map((r) => `<@&${r}>`)
								.join(', ') || '–',
					},
				)
				.setColor('Blue');

			await interaction.reply({ embeds: [embed], ephemeral: true });
		} catch (err) {
			console.error('❌ Gagal menampilkan role:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat menampilkan data dari database.',
			);
		}
	},
}).toJSON();
