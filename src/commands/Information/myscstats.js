const { ChatInputCommandInteraction, EmbedBuilder } = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const SpecialContractHistory = require('../../models/specialContractHistory');

module.exports = new ApplicationCommand({
	command: {
		name: 'myscstats',
		description: 'Statistik Special Contract kamu',
		type: 1,
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		const guildId = interaction.guild.id;
		const userId = interaction.user.id;

		const data = await SpecialContractHistory.find({
			guildId,
			driverId: userId,
		});

		if (!data.length)
			return interaction.editReply('❌ Tidak ada data Special Contract.');

		const totalRuns = data.length;
		const totalDistance = data.reduce((a, b) => a + b.distanceKm, 0);
		const avgRating = (
			data.reduce((a, b) => a + b.rating, 0) / totalRuns
		).toFixed(2);
		const avgDistance = Math.round(totalDistance / totalRuns);

		const embed = new EmbedBuilder()
			.setTitle(
				`📊 Statistik Special Contract — ${interaction.user.username}`,
			)
			.setColor('Gold')
			.addFields(
				{
					name: '🏁 Total SC Selesai',
					value: `${totalRuns}`,
					inline: true,
				},
				{
					name: '📍 Total Kilometer',
					value: `${totalDistance} km`,
					inline: true,
				},
				{
					name: '⭐ Rata-Rata Rating',
					value: `${avgRating}`,
					inline: true,
				},
				{
					name: '🚚 Rata-Rata Jarak',
					value: `${avgDistance} km`,
					inline: true,
				},
			)
			.setTimestamp();

		interaction.editReply({ embeds: [embed] });
	},
}).toJSON();
