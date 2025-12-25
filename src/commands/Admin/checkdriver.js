const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot.js');
const ApplicationCommand = require('../../structure/ApplicationCommand.js');
const DriverRegistry = require('../../models/driverlink.js');
const GuildSettings = require('../../models/guildsetting.js');

module.exports = new ApplicationCommand({
	command: {
		name: 'checkdriver',
		description: 'Melihat informasi driver berdasarkan Trucky ID atau Discord User',
		type: 1,
		options: [
			{
				name: 'truckyid',
				description: 'ID driver sesuai di Trucky',
				type: ApplicationCommandOptionType.Integer,
				required: false,
			},
			{
				name: 'user',
				description: 'Discord user driver',
				type: ApplicationCommandOptionType.User,
				required: false,
			},
		],
	},
	options: {
		allowedRoles: ['manager'],
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const guildId = interaction.guild.id;
			const managerId = interaction.user.id;

			// 🔐 Ambil role manager dari database
			const settings = await GuildSettings.findOne({ guildId });
			if (!settings || !settings.roles.manager?.length) {
				return interaction.editReply(
					'⚠️ Role manager belum diset di guild settings.',
				);
			}

			const member = interaction.guild.members.cache.get(managerId);
			const isManager = member.roles.cache.some((r) =>
				settings.roles.manager.includes(r.id),
			);

			if (!isManager) {
				return interaction.editReply(
					'❌ Kamu tidak memiliki izin untuk menjalankan command ini.',
				);
			}

			// 📥 Ambil input
			const truckyId = interaction.options.getInteger('truckyid');
			const user = interaction.options.getUser('user');

			if (!truckyId && !user) {
				return interaction.editReply(
					'⚠️ Harap masukkan **Trucky ID** atau **Discord User**.',
				);
			}

			// 🔍 Query dinamis
			const query = { guildId };

			if (truckyId) query.truckyId = truckyId;
			if (user) query.userId = user.id;

			const driver = await DriverRegistry.findOne(query);
			if (!driver) {
				return interaction.editReply(
					'⚠️ Driver tidak ditemukan.',
				);
			}

			const targetMember = await interaction.guild.members
				.fetch(driver.userId)
				.catch(() => null);

			// 📊 Embed
			const embed = new EmbedBuilder()
				.setTitle('🗒️ Informasi Driver')
				.setColor('Green')
				.setThumbnail(
					targetMember
						? targetMember.user.displayAvatarURL()
						: interaction.client.user.displayAvatarURL(),
				)
				.addFields(
					{
						name: 'Discord User',
						value: `<@${driver.userId}>`,
						inline: true,
					},
					{
						name: 'Trucky Name',
						value: driver.truckyName,
						inline: true,
					},
					{
						name: 'Trucky ID',
						value: String(driver.truckyId),
						inline: true,
					},
					{
						name: 'Linked Since',
						value: `<t:${Math.floor(
							driver.createdAt.getTime() / 1000,
						)}:D>`,
						inline: true,
					},
				)
				.setTimestamp();

			return interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error('❌ Error checkdriver:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat memproses permintaan.',
			);
		}
	},
}).toJSON();
