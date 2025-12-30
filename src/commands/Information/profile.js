const { ChatInputCommandInteraction, ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

// nanti kita buat file ini
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const GuildSettings = require('../../models/guildsetting');
const { getProfileData } = require('../../services/profile.service');
const { buildProfileEmbed } = require('../../utils/profileEmbed');
const { evaluateDriver } = require('../../services/evaluation.service');
const { isManager } = require('../../utils/permissionManager');

// GANTI sesuai ID role di server kamu
module.exports = new ApplicationCommand({
	command: {
		name: 'profile',
		description: 'Melihat profil kamu',
		type: 1,
		options: [
			{
				name: 'user',
				description: 'Siapa yang ingin dicek (khusus manager)',
				type: ApplicationCommandOptionType.User,
				required: false,
			},
		],
	},
	options: {
		allowedRoles: ['driver'],
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		const member = interaction.member;
		const target = interaction.options.getUser('user') || interaction.user;

		// 2️⃣ Defer reply (karena nanti ada DB query)
		await interaction.deferReply({ ephemeral: true });

		try {
			const setting = await GuildSettings.findOne({
				guildId: interaction.guild.id,
			});
			if (!setting) {
				return interaction.editReply({
					content: '⚠️ Pengaturan guild tidak ditemukan.',
				});
			}

			// Cek manager
			const isManager = setting?.roles?.manager?.some((roleId) =>
				interaction.member.roles.cache.has(roleId),
			);

			// User biasa tidak boleh cek wallet orang lain
			if (target.id !== interaction.user.id && !isManager) {
				return interaction.reply({
					content:
						'❌ Kamu tidak memiliki izin untuk melihat wallet orang lain.',
					ephemeral: true,
				});
			}

			if (isManager) {
				evaluation = await evaluateDriver({
					guildId: interaction.guild.id,
					userId: target.id,
				});
			}

			// 3️⃣ Ambil data profile (Phase 1: internal)
			const profileData = await getProfileData(
				interaction.guild.id,
				interaction.user.id,
			);

			if (!profileData) {
				return interaction.editReply({
					content: '⚠️ Data profile kamu tidak ditemukan.',
				});
			}

			// 4️⃣ Build embed
			const embed = buildProfileEmbed({
				user: interaction.user,
				member,
				profile: profileData,
			});

			// 5️⃣ Kirim hasil
			await interaction.editReply({
				embeds: [embed],
			});
		} catch (error) {
			console.error('[PROFILE COMMAND ERROR]', error);

			await interaction.editReply({
				content: '❌ Terjadi kesalahan saat mengambil data profile.',
			});
		}
	},
}).toJSON();
