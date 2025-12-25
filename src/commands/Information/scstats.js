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
		description: 'Statistik & leaderboard Special Contract (bulanan & tahunan)',
		type: 1,
	},
	options: {
		allowedRoles: ['driver'],
	},

	/**
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
		// DATA BULAN & TAHUN
		// ===============================
		const [monthData, yearData] = await Promise.all([
			SCH.find({ guildId, completedAt: { $gte: startMonth } }),
			SCH.find({ guildId, completedAt: { $gte: startYear } }),
		]);

		if (!monthData.length) {
			return interaction.editReply(
				'📭 Belum ada Special Contract selesai bulan ini.',
			);
		}

		// ===============================
		// STATISTIK BULANAN (TOTAL)
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
		// STATISTIK PERSONAL BULANAN
		// ===============================
		const myData_M = monthData.filter((d) => d.driverId === userId);

		const mySC = myData_M.length;
		const myKM = myData_M.reduce((a, b) => a + b.distanceKm, 0);
		const myNC = myKM;
		const myRevenue = myData_M.reduce((a, b) => a + b.revenue, 0);
		const myTons = myData_M.reduce((a, b) => a + b.cargoMass, 0);
		const myAvgRating = mySC
			? (myData_M.reduce((a, b) => a + b.rating, 0) / mySC).toFixed(2)
			: '0.00';

		// ===============================
		// LEADERBOARD BULANAN (TOP 3)
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
			{ $limit: 3 },
		]);

		const medals = ['🥇', '🥈', '🥉'];

		const lbMonthText = await Promise.all(
			lbMonth.map(async (row, i) => {
				const member = await interaction.guild.members
					.fetch(row._id)
					.catch(() => null);

				return `**${medals[i]} ${member ? member.displayName : 'Unknown'}**
• SC: **${row.totalSC}**
• KM: **${row.totalKM} km**
• Revenue: **${formatCurrency(row.totalRevenue)} T¢**
• Cargo: **${row.totalTons} tons**`;
			}),
		);

		// ===============================
		// EMBED BULANAN
		// ===============================
		const embedMonth = new EmbedBuilder()
			.setTitle(
				`📦 Statistik Bulanan — ${now.toLocaleString('id-ID', {
					month: 'long',
					year: 'numeric',
				})}`,
			)
			.setColor('Blue')
			.setThumbnail(interaction.guild.iconURL({ forceStatic: false }))
			.addFields(
				{ name: '🚛 Total SC', value: `${totalSC_M}`, inline: true },
				{ name: '🛣️ Total KM', value: `${Math.round(totalKM_M)} km`, inline: true },
				{ name: '💷 Total N¢', value: `${formatCurrency(totalNC_M)}`, inline: true },
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

				{ name: '👤 SC Kamu', value: `${mySC}`, inline: true },
				{ name: '🛣️ KM Kamu', value: `${Math.round(myKM)} km`, inline: true },
				{ name: '💷 N¢ Kamu', value: `${formatCurrency(myNC)}`, inline: true },
				{
					name: '💵 Revenue Kamu',
					value: `${formatCurrency(myRevenue)} T¢`,
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
					name: '🏆 Leaderboard Bulanan (Top 3)',
					value: lbMonthText.join('\n\n') || 'Belum ada data.',
				},
			)
			.setTimestamp();

		// ===============================
		// STATISTIK TAHUNAN
		// ===============================
		const totalSC_Y = yearData.length;
		const totalKM_Y = yearData.reduce((a, b) => a + b.distanceKm, 0);
		const totalNC_Y = totalKM_Y;
		const totalRevenue_Y = yearData.reduce((a, b) => a + b.revenue, 0);
		const totalTons_Y = yearData.reduce((a, b) => a + b.cargoMass, 0);
		const avgRating_Y = totalSC_Y
			? (
					yearData.reduce((a, b) => a + b.rating, 0) / totalSC_Y
			  ).toFixed(2)
			: '0.00';

		// ===============================
		// LEADERBOARD TAHUNAN (TOP 3)
		// ===============================
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
			{ $limit: 3 },
		]);

		const lbYearText = await Promise.all(
			lbYear.map(async (row, i) => {
				const member = await interaction.guild.members
					.fetch(row._id)
					.catch(() => null);

				return `**${medals[i]} ${member ? member.displayName : 'Unknown'}**
• SC: **${row.totalSC}**
• KM: **${row.totalKM} km**
• Revenue: **${formatCurrency(row.totalRevenue)} T¢**
• Cargo: **${row.totalTons} tons**`;
			}),
		);

		// ===============================
		// EMBED TAHUNAN
		// ===============================
		const embedYear = new EmbedBuilder()
			.setTitle(`📅 Statistik Tahunan — ${now.getFullYear()}`)
			.setColor('Purple')
			.setThumbnail(interaction.guild.iconURL({ forceStatic: false }))
			.addFields(
				{ name: '🚛 Total SC', value: `${totalSC_Y}`, inline: true },
				{ name: '🛣️ Total KM', value: `${Math.round(totalKM_Y)} km`, inline: true },
				{ name: '💷 Total N¢', value: `${formatCurrency(totalNC_Y)}`, inline: true },
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
					name: '🏆 Leaderboard Tahunan (Top 3)',
					value: lbYearText.join('\n\n') || 'Belum ada data.',
				},
			)
			.setTimestamp();

		// ===============================
		// PAGINATION
		// ===============================
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
			if (i.user.id !== userId) {
				return i.reply({
					content: '❌ Kamu tidak boleh menggunakan menu ini.',
					ephemeral: true,
				});
			}

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