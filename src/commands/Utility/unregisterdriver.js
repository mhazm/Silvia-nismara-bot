const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DriverRegistry = require('../../models/driverlink.js');
const GuildSettings = require('../../models/guildsetting.js');

module.exports = new ApplicationCommand({
	command: {
		name: 'unregisterdriver',
		description: 'Menghapus driver dari sistem',
		type: 1,
		options: [
			{
				name: 'user',
				description: 'User Discord yang ingin dihapus',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		const guildId = interaction.guild.id;
		const managerId = interaction.user.id;

		try {
			const settings = await GuildSettings.findOne({ guildId });
			if (!settings)
				return interaction.editReply(
					'⚠️ GuildSettings belum di-setup.',
				);

			const member = interaction.guild.members.cache.get(managerId);
			const isManager = member.roles.cache.some((r) =>
				settings.roles.manager.includes(r.id),
			);

			if (!isManager) {
				return interaction.editReply(
					'❌ Kamu tidak memiliki izin untuk menghapus driver.',
				);
			}

			const user = interaction.options.getUser('user');

			const result = await DriverRegistry.findOneAndDelete({
				guildId,
				userId: user.id,
			});

			if (!result) {
				return interaction.editReply('⚠️ User ini belum terdaftar.');
			}

			return interaction.editReply(
				`✅ Driver **${user.username}** berhasil dihapus.`,
			);
		} catch (err) {
			console.error(err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat menghapus driver.',
			);
		}
	},
}).toJSON();
