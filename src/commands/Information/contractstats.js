const {
	ChatInputCommandInteraction,
	EmbedBuilder,
} = require('discord.js');

const ApplicationCommand = require('../../structure/ApplicationCommand');
const JobHistory = require('../../models/jobHistory');

module.exports = new ApplicationCommand({
	command: {
		name: 'contractstats',
		description: 'Statistik Special Contract (Bulanan & Tahunan)',
		type: 1,
	},
	options: {
		allowedRoles: ['driver'],
	},

	/**
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply();

		try {
			const guildId = interaction.guild.id;

			const now = new Date();

			// Awal bulan
			const startOfMonth = new Date(
				now.getFullYear(),
				now.getMonth(),
				1
			);

			// Awal tahun
			const startOfYear = new Date(now.getFullYear(), 0, 1);

			// ======================
			// TOTAL BULAN INI
			// ======================
			const monthlyTotal = await JobHistory.countDocuments({
				guildId,
				isSpecialContract: true,
				jobStatus: 'COMPLETED',
				createdAt: { $gte: startOfMonth },
			});

			// ======================
			// TOTAL TAHUN INI
			// ======================
			const yearlyTotal = await JobHistory.countDocuments({
				guildId,
				isSpecialContract: true,
				jobStatus: 'COMPLETED',
				createdAt: { $gte: startOfYear },
			});

			// Optional breakdown per game
			const monthlyETS2 = await JobHistory.countDocuments({
				guildId,
				isSpecialContract: true,
				jobStatus: 'COMPLETED',
				gameId: 1,
				createdAt: { $gte: startOfMonth },
			});

			const monthlyATS = await JobHistory.countDocuments({
				guildId,
				isSpecialContract: true,
				jobStatus: 'COMPLETED',
				gameId: 2,
				createdAt: { $gte: startOfMonth },
			});

			const embed = new EmbedBuilder()
				.setColor(0x9b59b6)
				.setTitle('📊 Statistik Special Contract')
				.setDescription(
					'Statistik berdasarkan job dengan status COMPLETED'
				)
				.addFields(
					{
						name: '📅 Bulan Ini',
						value:
							`Total: **${monthlyTotal}**\n` +
							`ETS2: ${monthlyETS2}\n` +
							`ATS: ${monthlyATS}`,
						inline: true,
					},
					{
						name: '📆 Tahun Ini',
						value: `Total: **${yearlyTotal}**`,
						inline: true,
					}
				)
				.setFooter({
					text: 'Nismara Transport',
				})
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('[CONTRACT STATS ERROR]', error);
			await interaction.editReply({
				content: '❌ Gagal mengambil statistik contract.',
			});
		}
	},
}).toJSON();