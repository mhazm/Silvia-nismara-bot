const { ChatInputCommandInteraction, EmbedBuilder } = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Point = require('../../models/points');

module.exports = new ApplicationCommand({
	command: {
		name: 'pointdb',
		description: 'Dashboard ringkasan penalty driver',
		type: 1,
	},
	options: {
		allowedRoles: ['manager', 'moderator'],
		cooldown: 10000,
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		const guildId = interaction.guild.id;

		// Ambil semua data penalty
		const points = await Point.find({ guildId }).sort({
			totalPoints: -1,
		});

		// Kategori
		const highRisk = [];
		const mediumRisk = [];
		const warning = [];
		let safeCount = 0;

		let totalPenaltyPoints = 0; // 🔹 TOTAL GLOBAL

		for (const p of points) {
			totalPenaltyPoints += p.totalPoints;

			if (p.totalPoints >= 50) {
				highRisk.push(p);
			} else if (p.totalPoints >= 30) {
				mediumRisk.push(p);
			} else if (p.totalPoints >= 10) {
				warning.push(p);
			} else {
				safeCount++;
			}
		}

		// Helper tampilkan list
		const formatList = (arr, limit = 5) => {
			if (!arr.length) return '_Tidak ada_';

			return (
				arr
					.slice(0, limit)
					.map((p) => `• <@${p.userId}> — **${p.totalPoints} pts**`)
					.join('\n') +
				(arr.length > limit ? `\n_+${arr.length - limit} lainnya_` : '')
			);
		};

		const embed = new EmbedBuilder()
			.setTitle('🚨 Penalty Dashboard')
			.setColor('DarkRed')
			.setDescription(
				'Ringkasan kondisi penalty driver berdasarkan total poin.',
			)
			.addFields(
				{
					name: '🔴 Risiko Tinggi (≥ 50)',
					value: formatList(highRisk),
				},
				{
					name: '🟠 Perlu Perhatian (≥ 30)',
					value: formatList(mediumRisk),
				},
				{
					name: '🟡 Warning Awal (≥ 10)',
					value: formatList(warning),
				},
				{
					name: '🟢 Aman (< 10)',
					value: `**${safeCount} driver**`,
				},
				{
					name: '📊 Total Penalty Server',
					value: `**${totalPenaltyPoints} points**`,
				},
			)
			.setFooter({
				text: `Total Driver Tercatat: ${points.length}`,
			})
			.setTimestamp();

		await interaction.editReply({ embeds: [embed] });
	},
}).toJSON();
