const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const ActiveJob = require('../../models/activejob');
const JobHistory = require('../../models/jobHistory');

module.exports = new ApplicationCommand({
	command: {
		name: 'myjob',
		description: 'Lihat job yang sedang kamu jalankan',
		type: 1,
		options: [
			{
				name: 'game',
				description: 'Pilih game untuk kontrak ini. 1 = ETS2, 2 = ATS',
				choices: [
					{ name: 'Euro Truck Simulator 2', value: 1 },
					{ name: 'American Truck Simulator', value: 2 },
				],
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
		],
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
		const guildId = interaction.guild.id;
		const userId = interaction.user.id;
		const gameId = interaction.options.getInteger('game');

		const active = await JobHistory.findOne({
			guildId,
			driverId: userId,
			gameId: gameId,
			jobStatus: 'ONGOING',
		});
		if (!active)
			return interaction.reply(
				'❌ Kamu tidak sedang menjalankan pekerjaan.',
			);

		const embed = new EmbedBuilder()
			.setTitle('🚧 Pekerjaan Aktif')
			.setColor('Yellow')
			.addFields(
				{ name: 'Game', value: `${active.game} (${active.gameMode})` },
				{ name: 'Perusahaan', value: active.sourceCompany },
				{
					name: 'Rute',
					value: `${active.sourceCity} → ${active.destinationCity}`,
				},
				{ name: 'Market', value: active.marketType },
				{ name: 'Kargo', value: `${active.cargoName} (${active.cargoMass} t)`, inline: true },
				{ name: 'Jarak', value: `${active.plannedDistanceKm} km`, inline: true },
				{ name: 'Dimulai Pada', value: `<t:${Math.floor(active.startedAt.getTime() / 1000)}:F>`, inline: true },
			)
			.setFooter({ text: `Job ID: ${active.jobId}` })
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	},
}).toJSON();
