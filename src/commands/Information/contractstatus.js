const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
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
		const contract = await Contract.findOne({ guildId });

		if (!contract || !contract.companyName) {
			return interaction.reply(
				'⚠️ Belum ada kontrak aktif di server ini.',
			);
		}

		const embed = new EmbedBuilder()
			.setTitle('📦 Status Kontrak Aktif')
			.setColor('Blue')
			.setImage(contract.imageUrl)
			.addFields(
				{
					name: 'Perusahaan',
					value: contract.companyName,
					inline: true,
				},
				{
					name: 'Channel Notifikasi',
					value: contract.channelId
						? `<#${contract.channelId}>`
						: '❌ Belum diset',
					inline: true,
				},
				{
					name: 'Ditetapkan Oleh',
					value: `<@${contract.setBy}>`,
					inline: true,
				},
			)
			.setFooter({
				text: `Ditetapkan pada ${contract.setAt.toLocaleString()}`,
			});

		await interaction.reply({ embeds: [embed] });
	},
}).toJSON();
