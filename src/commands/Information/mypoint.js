const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');

module.exports = new ApplicationCommand({
	command: {
		name: 'mypoint',
		description: 'Melihat poin kamu sendiri',
		type: 1,
		options: [],
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const guildId = interaction.guild.id;
			const userId = interaction.user.id;

			const history = await PointHistory.find({ guildId, userId })
				.sort({ createdAt: -1 })
				.limit(10);
			const total = await Point.findOne({ guildId, userId });

			if (!history.length)
				return interaction.editReply(
					'Kamu belum memiliki riwayat poin.',
				);

			const desc = history
				.map((h) => {
					const date = `<t:${Math.floor(h.createdAt.getTime() / 1000)}:f>`;
					const sign = h.type === 'add' ? '➕' : '➖';
					return `${sign} **${h.points}** poin — ${h.reason} *(oleh <@${h.managerId}>, ${date})*`;
				})
				.join('\n');

			const embed = new EmbedBuilder()
				.setTitle(`📊 Riwayat Poin ${interaction.user.username}`)
				.setColor('Blue')
				.setDescription(desc)
				.addFields({
					name: 'Total Poin Saat Ini',
					value: `${total?.totalPoints ?? 0}`,
					inline: false,
				})
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error('❌ Gagal memuat data point baru:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat memuat data dari database.',
			);
		}
	},
}).toJSON();
