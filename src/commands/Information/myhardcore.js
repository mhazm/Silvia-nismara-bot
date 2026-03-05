const {
	ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const jobHistory = require('../../models/jobHistory');
const validatedJob = require('../../models/validatedJob');

module.exports = new ApplicationCommand({
	command: {
		name: 'myhardcore',
		description: 'Lihat riwayat pekerjaan hardcore kamu',
		type: 1,
		options: [],
	},
	options: {
		allowedRoles: ['driver'],
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

		const history = await jobHistory
			.find({
				guildId,
				driverId: userId,
				isHardcore: true,
				jobStatus: 'COMPLETED',
			})
			.sort({ completedAt: -1 });

		if (!history.length) {
			return interaction.editReply(
				'❌ Kamu belum pernah menyelesaikan Pekerjaan dengan Hardcore Mode.',
			);
		}

		// Ambil jobId dari history untuk cek validasi
		const jobIds = history.map((h) => h.jobId);
		const validated = await validatedJob
			.find({
				guildId,
				jobId: { $in: jobIds },
			})
			.select('jobId');

		const validatedSet = new Set(validated.map((v) => v.jobId));

		let page = 0;
		const perPage = 4;
		const totalPages = Math.ceil(history.length / perPage);

		const renderEmbed = (p) => {
			const slice = history.slice(p * perPage, (p + 1) * perPage);
			const desc = slice
				.map(
					(h) =>
						`**#${h.jobId}** — ${h.distanceKm} km — ⭐${h.hardcoreRating}\n` +
						`📦 **${h.cargoName} (${h.cargoMass}t)**\n` +
						`🏭 ${h.sourceCompany} (${h.sourceCity}) → ${h.destinationCompany} (${h.destinationCity})\n` +
						`🕒 <t:${Math.floor(h.completedAt.getTime() / 1000)}:f>\n` +
                        `${validatedSet.has(h.jobId) ? '✅ Validated' : '❌ Belum divalidasi'}\n`,
				)
				.join('\n────────────────────\n\n');

			return new EmbedBuilder()
				.setTitle(
					`📦 Hardcore Job History — ${interaction.user.displayName}`,
				)
				.setDescription(desc)
				.setColor('Blue')
				.setFooter({ text: `Halaman ${p + 1} dari ${totalPages}` })
				.setTimestamp();
		};

		const row = (disabled) =>
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('prev')
					.setLabel('◀')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(disabled || page === 0),
				new ButtonBuilder()
					.setCustomId('next')
					.setLabel('▶')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(disabled || page === totalPages - 1),
			);

		const msg = await interaction.editReply({
			embeds: [renderEmbed(page)],
			components: [row(false)],
		});

		const collector = msg.createMessageComponentCollector({
			time: 120_000,
		});

		collector.on('collect', async (i) => {
			if (i.user.id !== userId)
				return i.reply({
					content: '❌ Ini bukan menu milikmu.',
					ephemeral: true,
				});

			if (i.customId === 'next') page++;
			if (i.customId === 'prev') page--;

			await i.update({
				embeds: [renderEmbed(page)],
				components: [row(false)],
			});
		});

		collector.on('end', () => {
			msg.edit({ components: [row(true)] }).catch(() => {});
		});
	},
}).toJSON();
