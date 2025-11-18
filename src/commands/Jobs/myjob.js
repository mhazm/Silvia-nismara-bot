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
		name: 'myjob',
		description: 'Lihat job special contract yang sedang kamu jalankan',
		type: 1,
		options: [],
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

		const active = await ActiveJob.findOne({
			guildId,
			driverId: userId,
			active: true,
		});
		if (!active)
			return interaction.reply(
				'❌ Kamu tidak sedang menjalankan job special contract.',
			);

		const embed = new EmbedBuilder()
			.setTitle('🚧 Special Contract Job Aktif')
			.setColor('Yellow')
			.addFields(
				{ name: 'Perusahaan', value: active.companyName, inline: true },
				{
					name: 'Rute',
					value: `${active.source} → ${active.destination}`,
					inline: true,
				},
				{ name: 'Kargo', value: active.cargo, inline: true },
			)
			.setFooter({ text: `Job ID: ${active.jobId}` })
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	},
}).toJSON();
