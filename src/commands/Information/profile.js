const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	ActionRowBuilder,
	StringSelectMenuBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const GuildSettings = require('../../models/guildsetting');
const { getProfileData } = require('../../services/profile.service');
const { evaluateDriver } = require('../../services/evaluation.service');

const {
	buildProfileEmbed,
	buildWalletEmbed,
	buildPointEmbed,
	buildRecentJobsEmbed,
} = require('../../utils/profileEmbed');

module.exports = new ApplicationCommand({
	command: {
		name: 'profile',
		description: 'Melihat profil kamu',
		type: 1,
		options: [
			{
				name: 'user',
				description: 'Cek profil user lain (khusus manager)',
				type: ApplicationCommandOptionType.User,
				required: false,
			},
		],
	},
	options: {
		allowedRoles: ['driver'],
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const target =
				interaction.options.getUser('user') || interaction.user;

			const setting = await GuildSettings.findOne({
				guildId: interaction.guild.id,
			});
			if (!setting) {
				return interaction.editReply({
					content: '⚠️ Pengaturan guild tidak ditemukan.',
				});
			}

			const isManager = setting?.roles?.manager?.some((roleId) =>
				interaction.member.roles.cache.has(roleId),
			);

			if (target.id !== interaction.user.id && !isManager) {
				return interaction.editReply({
					content: '❌ Kamu tidak memiliki izin.',
				});
			}

			let evaluation = null;
			if (isManager) {
				evaluation = await evaluateDriver({
					guildId: interaction.guild.id,
					userId: target.id,
				});
			}

			const profileData = await getProfileData(
				interaction.guild.id,
				target.id,
			);

			if (!profileData) {
				return interaction.editReply({
					content: '⚠️ Data profile tidak ditemukan.',
				});
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('profile_menu')
				.setPlaceholder('Pilih halaman')
				.addOptions([
					{
						label: '🪪 Profile',
						value: 'profile',
					},
					{
						label: '💳 Wallet',
						value: 'wallet',
					},
					{
						label: '⚠️ Points',
						value: 'points',
					},
					{
						label: '🚛 Pekerjaan Terakhir',
						value: 'recent_jobs',
					},
				]);

			const row = new ActionRowBuilder().addComponents(selectMenu);

			let currentEmbed = buildProfileEmbed({
				user: target,
				profile: profileData,
				evaluation,
			});

			const message = await interaction.editReply({
				embeds: [currentEmbed],
				components: [row],
			});

			const collector = message.createMessageComponentCollector({
				time: 5 * 60 * 1000,
			});

			collector.on('collect', async (i) => {
				if (i.user.id !== interaction.user.id)
					return i.reply({
						content: '❌ Ini bukan interaksi kamu.',
						ephemeral: true,
					});

				let newEmbed;

				switch (i.values[0]) {
					case 'profile':
						newEmbed = buildProfileEmbed({
							user: target,
							profile: profileData,
							evaluation,
						});
						break;

					case 'wallet':
						newEmbed = buildWalletEmbed({
							user: target,
							profile: profileData,
						});
						break;

					case 'points':
						newEmbed = buildPointEmbed({
							user: target,
							profile: profileData,
						});
						break;

					case 'recent_jobs':
						newEmbed = buildRecentJobsEmbed({
							user: target,
							profile: profileData,
						});
						break;
				}

				await i.update({ embeds: [newEmbed] });
			});
		} catch (err) {
			console.error('[PROFILE ERROR]', err);
			await interaction.editReply({
				content: '❌ Terjadi kesalahan.',
			});
		}
	},
}).toJSON();