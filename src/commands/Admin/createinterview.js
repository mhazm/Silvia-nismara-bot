const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	ChannelType,
	PermissionsBitField,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'createinterview',
		description: 'Buat channel interview private untuk user',
		options: [
			{
				name: 'user',
				description: 'User yang akan di interview',
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
		await interaction.deferReply({ ephemeral: true });

		const guild = interaction.guild;
		const guildId = guild.id;
		const targetUser = interaction.options.getUser('user');

		// =========================
		// GET SETTINGS
		// =========================
		const settings = await GuildSettings.findOne({ guildId });
		if (!settings || !settings.interviewCategory) {
			return interaction.editReply(
				'❌ Interview category belum diatur di GuildSettings.',
			);
		}

		const category = guild.channels.cache.get(settings.interviewCategory);

		if (!category || category.type !== ChannelType.GuildCategory) {
			return interaction.editReply('❌ Category interview tidak valid.');
		}

		// =========================
		// CHECK DUPLICATE
		// =========================
		const channelName = `interview_${targetUser.username.toLowerCase()}`;

		const existing = guild.channels.cache.find(
			(c) => c.type === ChannelType.GuildText && c.name === channelName,
		);

		if (existing) {
			return interaction.editReply(
				`⚠️ Channel interview untuk ${targetUser} sudah ada: ${existing}`,
			);
		}

		// =========================
		// BUILD PERMISSIONS
		// =========================
		const overwrites = [
			{
				id: guild.roles.everyone.id,
				deny: [PermissionsBitField.Flags.ViewChannel],
			},
			{
				id: targetUser.id,
				allow: [
					PermissionsBitField.Flags.ViewChannel,
					PermissionsBitField.Flags.SendMessages,
					PermissionsBitField.Flags.ReadMessageHistory,
				],
			},
			{
				id: interaction.client.user.id,
				allow: [
					PermissionsBitField.Flags.ViewChannel,
					PermissionsBitField.Flags.SendMessages,
					PermissionsBitField.Flags.ManageChannels,
				],
			},
		];

		// Role manager
		if (Array.isArray(settings.roles?.manager)) {
			for (const roleId of settings.roles.manager) {
				overwrites.push({
					id: roleId,
					allow: [
						PermissionsBitField.Flags.ViewChannel,
						PermissionsBitField.Flags.SendMessages,
						PermissionsBitField.Flags.ReadMessageHistory,
					],
				});
			}
		}

		// =========================
		// CREATE CHANNEL
		// =========================
		const channel = await guild.channels.create({
			name: channelName,
			type: ChannelType.GuildText,
			parent: category.id,
			permissionOverwrites: overwrites,
			reason: `Interview channel for ${targetUser.tag}`,
		});

		// =========================
		// SEND OPENING MESSAGE
		// =========================
		const embed = new EmbedBuilder()
			.setTitle('📋 Interview Channel')
			.setColor('Blue')
			.setDescription(
				`Halo ${targetUser} 👋\n\n` +
					`Channel ini dibuat untuk proses **interview / diskusi**.\n` +
					`Silakan menunggu arahan dari tim **Manager**.\n\n` +
					`🧑‍💼 Interviewer: <@&${settings.roles.manager[0]}>`,
			)
			.setTimestamp();

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`close_interview_${targetUser.id}`)
				.setLabel('🔒 Tutup Interview')
				.setStyle(ButtonStyle.Danger),
		);

		await channel.send({
			content: `${targetUser}`,
			embeds: [embed],
			components: [row],
		});

		await interaction.editReply(
			`✅ Channel interview berhasil dibuat: ${channel}`,
		);
	},
}).toJSON();
