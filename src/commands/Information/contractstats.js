const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const ActiveJob = require('../../models/activejob');

module.exports = new ApplicationCommand({
	command: {
		name: 'contractstats',
		description:
			'Melihat statistik special contract bulan ini dan tahun ini',
	},
	options: {
		allowedRoles: ['driver'],
		cooldown: 10000,
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply();

		try {
			const now = new Date();
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const startOfYear = new Date(now.getFullYear(), 0, 1);

			// Statistik bulan ini
			const monthCount = await ActiveJob.countDocuments({
				date: { $gte: startOfMonth },
			});
			const monthUsers = await ActiveJob.distinct('driverId', {
				date: { $gte: startOfMonth },
			});

			// Statistik tahun ini
			const yearCount = await ActiveJob.countDocuments({
				date: { $gte: startOfYear },
			});
			const yearUsers = await ActiveJob.distinct('driverId', {
				date: { $gte: startOfYear },
			});

			const embed = new EmbedBuilder()
				.setColor('#00AEEF')
				.setTitle('📊 Statistik Special Contract')
				.addFields(
					{
						name: '🗓️ Bulan Ini',
						value: `🚛 Total Job: **${monthCount}**\n👥 Driver Unik: **${monthUsers.length}**`,
						inline: true,
					},
					{
						name: '📅 Tahun Ini',
						value: `🚛 Total Job: **${yearCount}**\n👥 Driver Unik: **${yearUsers.length}**`,
						inline: true,
					},
				)
				.setFooter({
					text: 'Dihitung berdasarkan log special contract',
				})
				.setTimestamp();

			return interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error('❌ Gagal memuat statistik:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat memuat statistik.',
			);
		}
	},
}).toJSON();
