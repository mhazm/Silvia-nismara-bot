const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const NCEvent = require('../../models/ncevent');
const GuildSettings = require('../../models/guildsetting');
const NCEventHistory = require('../../models/nceventHistory');

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
				type: ApplicationCommandOptionType.Number,
				required: true,
				description: 'Multiplier NC Boost (contoh: 2 untuk 2x)',
			},
			{
				name: 'duration',
				type: ApplicationCommandOptionType.String,
				required: true,
				description: 'Durasi event (contoh: 7d, 12h, 30m)',
			},
			{
				name: 'nama_event',
				type: ApplicationCommandOptionType.String,
				required: true,
				description: 'Nama event NC Boost',
			},
			{
				name: 'image_url',
				type: ApplicationCommandOptionType.String,
				required: true,
				description: 'URL gambar event NC Boost',
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
		await interaction.deferReply();

		const guildId = interaction.guild.id;
		const userId = interaction.user.id;

		const multiplier = interaction.options.getNumber('multiplier');
		const durationStr = interaction.options.getString('duration');
		const nameEvent = interaction.options.getString('nama_event');
		const imageUrl = interaction.options.getString('image_url');

		if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(imageUrl)) {
			return interaction.editReply(
				'⚠️ URL gambar tidak valid. Gunakan link langsung ke file gambar.',
			);
		}

		const durationMs = parseDuration(durationStr);
		if (!durationMs) {
			return interaction.editReply(
				'❌ Format durasi tidak valid. Gunakan contoh: 7d, 12h, 30m',
			);
		}

		const startDate = new Date();
		const endAt = new Date(startDate.getTime() + durationMs);

		// 🔹 Replace / buat event aktif
		await NCEvent.findOneAndUpdate(
			{ guildId },
			{
				guildId,
				multiplier,
				nameEvent,
				imageUrl,
				setBy: userId,
				setAt: startDate,
				endAt,
			},
			{ upsert: true },
		);

		// 🔹 Simpan history (START EVENT)
		await NCEventHistory.create({
			guildId,
			multiplier,
			nameEvent,
			imageUrl,
			setBy: userId,
			startDate,
		});

		const settings = await GuildSettings.findOne({ guildId });
		const channelNotif = interaction.guild.channels.cache.get(
			settings?.eventNotifyChannel,
		);

		if (channelNotif) {
			const embed = new EmbedBuilder()
				.setTitle(`🔔 ${nameEvent} NC Boost Event Dimulai!`)
				.setColor('Yellow')
				.setDescription(
					`Event **${nameEvent}** dengan multiplier **x${multiplier}** telah dimulai.\n\n` +
						`🚚 Ayo lakukan pengiriman sebanyak mungkin!\n\n` +
						`🕒 Berakhir: <t:${Math.floor(
							endAt.getTime() / 1000,
						)}:F> (<t:${Math.floor(endAt.getTime() / 1000)}:R>)`,
				)
				.setImage(imageUrl)
				.setTimestamp()
				.setFooter({ text: 'Nismara Transport - Event Notification' });

			await channelNotif.send({ embeds: [embed] });
		}

		return interaction.editReply(
			`✅ **${nameEvent} NC Boost Event Aktif!**\n` +
				`Multiplier: **x${multiplier}**\n` +
				`Berakhir: <t:${Math.floor(endAt.getTime() / 1000)}:F>`,
		);
	},
}).toJSON();