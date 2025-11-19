const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const GuildSettings = require('../../models/guildsetting');
const Contract = require('../../models/contract');

const CHANNEL_TARGETS = {
	truckyWebhook: { model: 'GuildSettings', key: 'truckyWebhookChannel' },
	scChannel: { model: 'Channel', key: 'channelId' },
	botLog: { model: 'GuildSettings', key: 'channelLog' },
};

module.exports = new ApplicationCommand({
	command: {
		name: 'setchannel',
		description: 'Set channel khusus untuk perintah tertentu',
		type: 1,
		options: [
			{
				name: 'type',
				description: 'Jenis role yang ingin diatur',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{
						name: 'Trucky Webhook Channel',
						value: 'truckyWebhook',
					},
					{
						name: 'Bot Log Channel',
						value: 'botLog',
					},
					{
						name: 'Special Contract Channel',
						value: 'scChannel',
					},
				],
			},
			{
				name: 'channel',
				description: 'Pilih Discord Channel',
				type: 7,
				required: true,
			},
		],
	},
	options: {
		botDevelopers: true,
		allowedRoles: ['manager'],
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		try {
			const type = interaction.options.getString('type');
			const channel = interaction.options.getChannel('channel');

			const target = CHANNEL_TARGETS[type];
			if (!target)
				return interaction.reply({
					content: '❌ Tipe channel tidak dikenali.',
					ephemeral: true,
				});

			if (target.model === 'GuildSettings') {
				await GuildSettings.findOneAndUpdate(
					{ guildId: interaction.guild.id },
					{ [target.key]: channel.id },
					{ upsert: true },
				);
			} else if (target.model === 'Contract') {
				await Contract.findOneAndUpdate(
					{ guildId: interaction.guild.id },
					{ [target.key]: channel.id },
					{ upsert: true },
				);
			}

			return interaction.reply({
				content: `✔ **${type}** berhasil diset ke <#${channel.id}>`,
				ephemeral: true,
			});
		} catch (err) {
			console.error('❌ Gagal menyimpan role:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat menyimpan data ke database.',
			);
		}
	},
}).toJSON();
