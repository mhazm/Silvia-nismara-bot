const {
	ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');

const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');

module.exports = new ApplicationCommand({
	command: {
		name: 'mypoint',
		description: 'Melihat poin kamu sendiri dengan riwayat lengkap',
		type: 1,
		options: [],
	},

	run: async (client, interaction) => {
		const userId = interaction.user.id;
		const guildId = interaction.guild.id;

		await interaction.deferReply({ ephemeral: true });

		// Ambil total point
		let totalData = await Point.findOne({ guildId, userId });
		let totalPoints = totalData ? totalData.totalPoints : 0;

		// Ambil history
		const history = await PointHistory.find({ guildId, userId })
			.sort({ createdAt: -1 })
			.lean();

		if (history.length === 0) {
			return interaction.editReply(
				'📭 Kamu belum memiliki riwayat poin.',
			);
		}

		// Pagination setting
		const pageSize = 10;
		let page = 0;
		const totalPages = Math.max(1, Math.ceil(history.length / pageSize));

		const renderEmbed = () => {
			const start = page * pageSize;
			const items = history.slice(start, start + pageSize);

			const desc =
				items
					.map((h) => {
						const date = `<t:${Math.floor(h.createdAt.getTime() / 1000)}:f>`;
						const sign = h.type === 'add' ? '➕' : '➖';
						return `${sign} **${h.points}** poin — ${h.reason}\n*(oleh <@${h.managerId}>, ${date})*`;
					})
					.join('\n') || '_Tidak ada riwayat pada halaman ini._';

			return new EmbedBuilder()
				.setTitle(`📊 Riwayat Poin — ${interaction.user.username}`)
				.setColor('Blue')
				.addFields(
					{
						name: 'Total Poin Saat Ini',
						value: `${totalPoints}`,
						inline: false,
					},
					{ name: 'Riwayat Terbaru', value: desc },
				)
				.setFooter({ text: `Page ${page + 1} / ${totalPages}` })
				.setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
				.setTimestamp();
		};

		// Buttons
		const prevBtn = new ButtonBuilder()
			.setCustomId('mypoint_prev')
			.setStyle(ButtonStyle.Secondary)
			.setLabel('⬅ Prev');

		const nextBtn = new ButtonBuilder()
			.setCustomId('mypoint_next')
			.setStyle(ButtonStyle.Secondary)
			.setLabel('Next ➡');

		const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

		const msg = await interaction.editReply({
			embeds: [renderEmbed()],
			components: [row],
		});

		// Collector
		const collector = msg.createMessageComponentCollector({
			time: 120000, // 2 menit
		});

		collector.on('collect', async (i) => {
			// Mencegah orang lain klik
			if (i.user.id !== interaction.user.id)
				return i.reply({
					content: '❌ Ini tombol bukan untukmu.',
					ephemeral: true,
				});

			if (i.customId === 'mypoint_prev') {
				page = page > 0 ? page - 1 : totalPages - 1;
			} else if (i.customId === 'mypoint_next') {
				page = page + 1 < totalPages ? page + 1 : 0;
			}

			await i.update({
				embeds: [renderEmbed()],
				components: [row],
			});
		});

		collector.on('end', async () => {
			row.components.forEach((c) => c.setDisabled(true));
			msg.edit({ components: [row] }).catch(() => {});
		});
	},
}).toJSON();
