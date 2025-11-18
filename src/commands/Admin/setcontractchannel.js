const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Contract = require('../../models/contract');

module.exports = new ApplicationCommand({
	command: {
		name: 'setcontractchannel',
		description: 'Set channel discord untuk notifikasi kontrak job',
		type: 1,
		options: [
			{
				name: 'channel',
				description: 'Pilih channel untuk notifikasi kontrak job',
				type: 7, // Channel type
				required: true,
			},
		],
	},
	options: {
		botOwner: true,
		allowedRoles: ['manager'],
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });
		const channel = interaction.options.getChannel('channel');
		const guildId = interaction.guild.id;
		const userId = interaction.user.id;

		if (!channel.isTextBased()) {
			return interaction.reply({
				content: '❌ Pilih channel teks.',
				ephemeral: true,
			});
		}

		let contract = await GuildSettings.findOne({ guildId });
		if (!contract) {
			contract = new Contract({
				guildId,
				channelId: channel.id,
				setBy: userId,
			});
		} else {
			contract.channelId = channel.id;
			contract.setBy = userId;
			contract.setAt = new Date();
		}

		await contract.save();
		await interaction.reply({
			content: `✅ Channel kontrak diset ke ${channel}`,
			ephemeral: true,
		});
	},
}).toJSON();
