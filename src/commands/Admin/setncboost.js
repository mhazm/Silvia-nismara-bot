const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const NCEvent = require('../../models/ncevent');

function parseDuration(str) {
	const match = str.match(/^(\d+)([smhd])$/);
	if (!match) return null;

	const num = parseInt(match[1]);
	const unit = match[2];

	const multipliers = {
		s: 1000,
		m: 1000 * 60,
		h: 1000 * 60 * 60,
		d: 1000 * 60 * 60 * 24,
	};

	return num * multipliers[unit];
}

module.exports = new ApplicationCommand({
	command: {
		name: 'setncboost',
		description: 'Set multiplier NC Boost untuk reward event',
		type: 1,
		options: [
			{
				name: 'multiplier',
				description: 'Multiplier NC Boost (contoh: 2 untuk 2x)',
				type: ApplicationCommandOptionType.Number,
				required: true,
			},
			{
				name: 'duration',
				description:
					'Durasi event (contoh: 7d untuk hari, 72h untuk jam, 30m untuk menit)',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	options: {
		allowedRoles: ['manager'],
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		const guildId = interaction.guild.id;
		const multiplier = interaction.options.getNumber('multiplier');
		const durationStr = interaction.options.getString('duration');

		const durationMs = parseDuration(durationStr);
		if (!durationMs)
			return interaction.editReply(
				'❌ Format durasi tidak valid. Gunakan contoh: 7d, 12h, 30m',
			);

		const endAt = new Date(Date.now() + durationMs);

		await NCEvent.findOneAndUpdate(
			{ guildId },
			{ guildId, multiplier, endAt },
			{ upsert: true },
		);

		return interaction.editReply(
			`✅ **NC Boost Event Aktif!**\nMultiplier: **x${multiplier}**\nBerakhir: <t:${Math.floor(endAt.getTime() / 1000)}:F>`,
		);
	},
}).toJSON();
