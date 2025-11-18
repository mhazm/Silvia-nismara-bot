const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const ApplicationCommand = require('../../structure/ApplicationCommand');
const DiscordBot = require('../../client/DiscordBot');
const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'checkpoint',
		description: 'Lihat poin dan riwayat poin seorang driver.',
		type: 1,
		options: [
			{
				name: 'driver',
				description: 'Driver yang ingin dicek.',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	options: {
		allowedRoles: ['manager'],
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		const driver = interaction.options.getUser('driver');
		const guildId = interaction.guild.id;

		// Ambil pengaturan guild
		const settings = await GuildSettings.findOne({ guildId });
		const driverRoles = settings.roles?.driver || [];

		// Cek apakah punya driver role
		const member = await interaction.guild.members.fetch(driver.id);
		const isDriver = member.roles.cache.some((r) =>
			driverRoles.includes(r.id),
		);

		if (!isDriver) {
			return interaction.editReply('❌ User ini bukan driver.');
		}

		// Ambil data poin
		const pointData = await Point.findOne({ guildId, userId: driver.id });
		const totalPoints = pointData?.totalPoints ?? 0;

		// Ambil history poin terakhir
		const history = await PointHistory.find({ guildId, userId: driver.id })
			.sort({ createdAt: -1 })
			.limit(10);

		let historyText = history.length
			? history
					.map((h) => {
						const sign = h.type === 'add' ? '+' : '-';
						return `**${sign}${h.points}** — ${h.reason} _(oleh <@${h.managerId}>, <t:${Math.floor(h.createdAt / 1000)}:R>)_`;
					})
					.join('\n')
			: '_Tidak ada history poin._';

		const embed = new EmbedBuilder()
			.setTitle(`📌 Point Check: ${driver.username}`)
			.setColor('Blue')
			.addFields(
				{ name: 'Total Poin', value: `${totalPoints}`, inline: true },
				{ name: 'User', value: `<@${driver.id}>`, inline: true },
				{ name: 'Riwayat (10 Terakhir)', value: historyText },
			)
			.setThumbnail(driver.avatarURL())
			.setTimestamp();

		return interaction.editReply({ embeds: [embed] });
	},
}).toJSON();
