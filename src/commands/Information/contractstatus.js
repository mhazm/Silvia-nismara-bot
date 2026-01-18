const {
	ChatInputCommandInteraction,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Contract = require('../../models/contract');

module.exports = new ApplicationCommand({
	command: {
		name: 'contractstatus',
		description: 'Check status kontrak aktif',
		type: 1,
	},
	options: {
		allowedRoles: ['driver'],
		cooldown: 10000,
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		const guildId = interaction.guild.id;
		const contract = await Contract.findOne({ guildId });

		if (!contract) {
			return interaction.editReply(
				'⚠️ Belum ada kontrak aktif saat ini.'
			);
		}

		// 🔹 Hitung durasi berjalan
		const startedAtUnix = Math.floor(
			contract.setAt.getTime() / 1000
		);

		const runningDays = Math.ceil(
			(Date.now() - contract.setAt) /
				(1000 * 60 * 60 * 24)
		);

		// 🔹 Embed
		const embed = new EmbedBuilder()
			.setTitle('📦 Status Kontrak Aktif')
			.setColor('#00AEEF')
			.addFields(
				{
					name: '🏢 Perusahaan',
					value: contract.companyName,
				},
				{
					name: '🗓️ Mulai Kontrak',
					value: `<t:${startedAtUnix}:f>\n(<t:${startedAtUnix}:R>)`,
					inline: true,
				},
				{
					name: '⏳ Durasi Berjalan',
					value: `${runningDays} hari`,
					inline: true,
				},
				{
					name: '👤 Ditetapkan Oleh',
					value: contract.setBy
						? `<@${contract.setBy}>`
						: 'N/A',
				}
			)
			.setTimestamp();

		if (contract.imageUrl) {
			embed.setImage(contract.imageUrl);
		}

		return interaction.editReply({ embeds: [embed] });
	},
}).toJSON();