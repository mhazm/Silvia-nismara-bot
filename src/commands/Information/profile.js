const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const GuildSettings = require('../../models/guildsetting');
const { getProfileData } = require('../../services/profile.service');
const { buildProfileEmbed } = require('../../utils/profileEmbed');
const { evaluateDriver } = require('../../services/evaluation.service');

// =====================
// DROPDOWN BUILDER
// =====================
function buildProfileDropdown(userId) {
	return new ActionRowBuilder().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId(`profile_menu_${userId}`)
			.setPlaceholder('Pilih halaman profile...')
			.addOptions([
				{
					label: 'Profile',
					description: 'Informasi driver',
					value: 'profile',
				},
				{
					label: 'Wallet',
					description: 'Total currency & riwayat',
					value: 'wallet',
				},
				{
					label: 'Point',
					description: 'Total penalty & riwayat',
					value: 'point',
				},
			]),
	);
}

// =====================
// WALLET EMBED
// =====================
function buildWalletEmbed({ user, profile }) {
	const history = profile.walletHistory || [];

	const historyText = history
		.slice(0, 10)
		.map(
			(h) =>
				`• ${h.type} | ${h.amount}\n<t:${Math.floor(
					new Date(h.createdAt).getTime() / 1000,
				)}:R>`,
		)
		.join('\n');

	return new EmbedBuilder()
		.setColor(0x00b894)
		.setTitle(`💰 Wallet - ${user.username}`)
		.addFields(
			{
				name: 'Total Currency',
				value: `${profile.wallet || 0}`,
			},
			{
				name: 'Riwayat (10 Terakhir)',
				value: historyText || 'Belum ada transaksi.',
			},
		);
}

// =====================
// POINT EMBED
// =====================
function buildPointEmbed({ user, profile }) {
	const history = profile.pointHistory || [];

	const historyText = history
		.slice(0, 10)
		.map(
			(p) =>
				`• ${p.reason} | ${p.amount} poin\n<t:${Math.floor(
					new Date(p.createdAt).getTime() / 1000,
				)}:R>`,
		)
		.join('\n');

	return new EmbedBuilder()
		.setColor(0xe17055)
		.setTitle(`⚠️ Point - ${user.username}`)
		.addFields(
			{
				name: 'Total Penalty Point',
				value: `${profile.penaltyPoint || 0}`,
			},
			{
				name: 'Riwayat (10 Terakhir)',
				value: historyText || 'Belum ada riwayat penalty.',
			},
		);
}

// =====================
// COMMAND
// =====================
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

			// Cek manager role
			const isManager = setting?.roles?.manager?.some((roleId) =>
				interaction.member.roles.cache.has(roleId),
			);

			// User biasa tidak boleh cek orang lain
			if (target.id !== interaction.user.id && !isManager) {
				return interaction.editReply({
					content:
						'❌ Kamu tidak memiliki izin untuk melihat profile orang lain.',
				});
			}

			// Optional evaluation untuk manager
			if (isManager) {
				await evaluateDriver({
					guildId: interaction.guild.id,
					userId: target.id,
				});
			}

			// 🔥 FIX BUG: gunakan target.id
			const profileData = await getProfileData(
				interaction.guild.id,
				target.id,
			);

			if (!profileData) {
				return interaction.editReply({
					content: '⚠️ Data profile tidak ditemukan.',
				});
			}

			// Default embed = Profile Page
			const defaultEmbed = buildProfileEmbed({
				user: target,
				member,
				profile: profileData,
			});

			const message = await interaction.editReply({
				embeds: [defaultEmbed],
				components: [buildProfileDropdown(interaction.user.id)],
			});

			// =====================
			// DROPDOWN COLLECTOR
			// =====================
			const collector = message.createMessageComponentCollector({
				time: 1000 * 60 * 5,
			});

			collector.on('collect', async (select) => {
				if (select.user.id !== interaction.user.id) {
					return select.reply({
						content: '❌ Ini bukan profile kamu.',
						ephemeral: true,
					});
				}

				const value = select.values[0];
				let newEmbed;

				if (value === 'profile') {
					newEmbed = buildProfileEmbed({
						user: target,
						member,
						profile: profileData,
					});
				}

				if (value === 'wallet') {
					newEmbed = buildWalletEmbed({
						user: target,
						profile: profileData,
					});
				}

				if (value === 'point') {
					newEmbed = buildPointEmbed({
						user: target,
						profile: profileData,
					});
				}

				await select.update({
					embeds: [newEmbed],
					components: [buildProfileDropdown(interaction.user.id)],
				});
			});

			collector.on('end', async () => {
				await interaction.editReply({
					components: [],
				});
			});
		} catch (error) {
			console.error('[PROFILE COMMAND ERROR]', error);

			await interaction.editReply({
				content: '❌ Terjadi kesalahan saat mengambil data profile.',
			});
		}
	},
}).toJSON();