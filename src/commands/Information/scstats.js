const {
	ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const SCH = require('../../models/specialContractHistory');

function formatCurrency(num) {
	return num.toLocaleString('id-ID');
}

module.exports = new ApplicationCommand({
	command: {
		name: 'scstats',
		description:
			'Statistik & leaderboard Special Contract (bulanan & tahunan)',
		type: 1,
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply();

		const guildId = interaction.guild.id;
		const userId = interaction.user.id;

		const now = new Date();
		const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const startYear = new Date(now.getFullYear(), 0, 1);

		// ===============================
		//     QUERY BULAN & TAHUN
		// ===============================
		const monthData = await SCH.find({
			guildId,
			completedAt: { $gte: startMonth },
		});

		const yearData = await SCH.find({
			guildId,
			completedAt: { $gte: startYear },
		});

		if (!monthData.length)
			return interaction.editReply(
				'📭 Belum ada Special Contract selesai bulan ini.',
			);

		// ===============================
		//   STATISTIK BULANAN — TOTAL
		// ===============================
		const totalSC_M = monthData.length;
		const totalKM_M = monthData.reduce((a, b) => a + b.distanceKm, 0);
		const totalNC_M = totalKM_M;
		const totalRevenue_M = monthData.reduce((a, b) => a + b.revenue, 0);
		const totalTons_M = monthData.reduce((a, b) => a + b.cargoMass, 0);
		const avgRating_M = (
			monthData.reduce((a, b) => a + b.rating, 0) / totalSC_M
		).toFixed(2);

		// ===============================
		//       STATISTIK Personal
		// ===============================
		const myData_M = monthData.filter((d) => d.driverId === userId);

		const mySC = myData_M.length;
		const myKM = myData_M.reduce((a, b) => a + b.distanceKm, 0);
		const myNC = myKM;
		const myRevenue = myData_M.reduce((a, b) => a + b.revenue, 0);
		const myTons = myData_M.reduce((a, b) => a + b.cargoMass, 0);
		const myAvgRating = mySC
			? (myData_M.reduce((a, b) => a + b.rating, 0) / mySC).toFixed(2)
			: 0;

		// ===============================
		//   LEADERBOARD BULANAN
		// ===============================
		const lbMonth = await SCH.aggregate([
			{ $match: { guildId, completedAt: { $gte: startMonth } } },
			{
				$group: {
					_id: '$driverId',
					totalSC: { $sum: 1 },
					totalKM: { $sum: '$distanceKm' },
					totalRevenue: { $sum: '$revenue' },
					totalTons: { $sum: '$cargoMass' },
				},
			},
			{ $sort: { totalSC: -1, totalKM: -1 } },
			{ $limit: 10 },
		]);

		const lbMonthText = await Promise.all(
			lbMonth.map(async (row, i) => {
				const member = await interaction.guild.members
					.fetch(row._id)
					.catch(() => null);

				return `**#${i + 1} — ${member ? member.displayName : 'Unknown'}**
• SC: **${row.totalSC}**
• KM: **${row.totalKM} km**
• NC: **${row.totalKM}**
• Revenue: **${formatCurrency(row.totalRevenue)} T¢**
• Cargo: **${row.totalTons} tons**`;
			}),
		);

		// ============================================================== EMBED PAGE 1 — BULANAN
		const embedMonth = new EmbedBuilder()
			.setTitle(
				`📦 Special Contract — Statistik Bulanan (${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })})`,
			)
			.setColor('Blue')
			.addFields(
				{ name: '🚛 Total SC', value: `${totalSC_M} Jobs`, inline: true },
				{ name: '🛣️ Total KM', value: `${totalKM_M} km`, inline: true },
				{ name: '💷 Total N¢', value: `${totalNC_M} N¢`, inline: true },

				{
					name: '💵 Total Revenue',
					value: `${formatCurrency(totalRevenue_M)} T¢`,
					inline: true,
				},
				{
					name: '🧳 Total Cargo',
					value: `${totalTons_M} tons`,
					inline: true,
				},
				{
					name: '🌟 Rata-Rata Rating',
					value: `${avgRating_M}`,
					inline: true,
				},

				{ name: '👤 SC Kamu', value: `${mySC} Jobs`, inline: true },
				{ name: '🛣️ KM Kamu', value: `${myKM} km`, inline: true },
				{ name: '💷 N¢ Kamu', value: `${myNC} N¢`, inline: true },
				{
					name: '💵 Revenue Kamu',
					value: `${formatCurrency(myRevenue)} T¢ `,
					inline: true,
				},
				{
					name: '⚓ Cargo Kamu',
					value: `${myTons} tons`,
					inline: true,
				},
				{
					name: '⭐ Rating Kamu',
					value: `${myAvgRating}`,
					inline: true,
				},

				{
					name: '🏆 Leaderboard Bulanan',
					value: lbMonthText.join('\n\n'),
				},
			)
			.setTimestamp()
			.setThumbnail(interaction.guild.iconURL({ forceStatic: false }));

		// ===============================================
		//     STATISTIK Tahunan
		// ===============================================
		const totalSC_Y = yearData.length;
		const totalKM_Y = yearData.reduce((a, b) => a + b.distanceKm, 0);
		const totalNC_Y = totalKM_Y;
		const totalRevenue_Y = yearData.reduce((a, b) => a + b.revenue, 0);
		const totalTons_Y = yearData.reduce((a, b) => a + b.cargoMass, 0);
		const avgRating_Y = (
			yearData.reduce((a, b) => a + b.rating, 0) / totalSC_Y
		).toFixed(2);

		// Leaderboard tahunan
		const lbYear = await SCH.aggregate([
			{ $match: { guildId, completedAt: { $gte: startYear } } },
			{
				$group: {
					_id: '$driverId',
					totalSC: { $sum: 1 },
					totalKM: { $sum: '$distanceKm' },
					totalRevenue: { $sum: '$revenue' },
					totalTons: { $sum: '$cargoMass' },
				},
			},
			{ $sort: { totalSC: -1, totalKM: -1 } },
			{ $limit: 10 },
		]);

		const lbYearText = await Promise.all(
			lbYear.map(async (row, i) => {
				const member = await interaction.guild.members
					.fetch(row._id)
					.catch(() => null);

				return `**#${i + 1} — ${member ? member.displayName : 'Unknown'}**
• SC: **${row.totalSC}**
• KM: **${row.totalKM} km**
• NC: **${row.totalKM}**
• Revenue: **${formatCurrency(row.totalRevenue)} T¢**
• Cargo: **${row.totalTons} tons**`;
			}),
		);

		// ============================================================== EMBED PAGE 2 — TAHUNAN
		const embedYear = new EmbedBuilder()
			.setTitle(`📅 Statistik Tahunan (${now.getFullYear()})`)
			.setColor('Purple')
			.addFields(
				{ name: '🚛 Total SC', value: `${totalSC_Y} Jobs`, inline: true },
				{ name: '🛣️ Total KM', value: `${totalKM_Y} km`, inline: true },
				{ name: '💷 Total N¢', value: `${totalNC_Y} N¢`, inline: true },

				{
					name: '💵 Total Revenue',
					value: `${formatCurrency(totalRevenue_Y)} T¢`,
					inline: true,
				},
				{
					name: '🧳 Total Cargo',
					value: `${totalTons_Y} tons`,
					inline: true,
				},
				{
					name: '🌟 Rata-Rata Rating',
					value: `${avgRating_Y}`,
					inline: true,
				},

				{
					name: '🏆 Leaderboard Tahunan',
					value: lbYearText.join('\n\n'),
				},
			)
			.setTimestamp()
			.setThumbnail(interaction.guild.iconURL({ forceStatic: false }));

		// ===============================================================
		// Pagination
		// ===============================================================
		const pages = [embedMonth, embedYear];
		let currentPage = 0;

		const row = (disabled = false) =>
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('prev')
					.setLabel('◀')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(disabled || currentPage === 0),
				new ButtonBuilder()
					.setCustomId('next')
					.setLabel('▶')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(disabled || currentPage === pages.length - 1),
			);

		const msg = await interaction.editReply({
			embeds: [pages[0]],
			components: [row()],
		});

		const collector = msg.createMessageComponentCollector({
			time: 120_000,
		});

		collector.on('collect', async (i) => {
			if (i.user.id !== userId)
				return i.reply({
					content: '❌ Kamu tidak boleh menggunakan menu ini.',
					ephemeral: true,
				});

			if (i.customId === 'next') currentPage++;
			if (i.customId === 'prev') currentPage--;

			await i.update({
				embeds: [pages[currentPage]],
				components: [row()],
			});
		});

		collector.on('end', () => {
			msg.edit({ components: [row(true)] }).catch(() => {});
		});
	},
}).toJSON();
