const { EmbedBuilder } = require('discord.js');

function formatNumber(number = 0) {
	return number.toLocaleString('id-ID');
}

function formatDate(date) {
	if (!date) return '-';
	return new Date(date).toLocaleDateString('id-ID', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
	});
}

/* ============================= */
/* PROFILE PAGE */
/* ============================= */
function buildProfileEmbed({ user, member, profile, evaluation = null }) {
	const {
		currency = 0,
		penaltyPoints = 0,
		totalJobs = 0,
		specialJobs = 0,
		canceledJobs = 0,
	} = profile;

	const roleName =
		member?.roles?.cache.find((r) => r.name.toLowerCase().includes('sopir'))
			?.name ||
		member?.roles?.cache.find((r) =>
			r.name.toLowerCase().includes('magang'),
		)?.name ||
		'Driver';

	const embedColor = roleName.toLowerCase().includes('magang')
		? 0x4db6ff
		: 0xc8a2c8;

	const embed = new EmbedBuilder()
		.setColor(embedColor)
		.setTitle('👤 Driver Profile')
		.setThumbnail(user.displayAvatarURL({ dynamic: true }))
		.addFields(
			{
				name: '🔹 Informasi Dasar',
				value: `**Discord:** <@${user.id}>\n` + `**Role:** ${roleName}`,
			},
			{
				name: '💰 Statistik Internal',
				value:
					`**Currency:** ${formatNumber(currency)} NC\n` +
					`**Total Job:** ${totalJobs}\n` +
					`**Special Job:** ${specialJobs}\n` +
					`**Job Dibatalkan:** ${canceledJobs}\n` +
					`**Poin Penalti:** ${penaltyPoints}`,
			},
		)
		.setFooter({
			text: 'Nismara Transport',
		})
		.setTimestamp();

	if (profile.trucky) {
		embed.addFields({
			name: '🚛 Statistik Trucky',
			value:
				`**Nama:** ${profile.trucky.username}\n` +
				`**Role:** ${profile.trucky.role ?? '-'}\n` +
				`**Distance:** ${formatNumber(profile.trucky.distance)} km\n` +
				`**Cargo Mass:** ${formatNumber(profile.trucky.cargomass)} t\n` +
				`**Last Activity:** ${formatDate(profile.trucky.lastActivity)}\n` +
				`**Status:** ${
					profile.trucky.inactive ? '🔴 Inactive' : '🟢 Active'
				}`,
		});
	}

	// Evaluation hanya untuk manager
	if (evaluation) {
		embed.addFields({
			name: '📊 Driver Evaluation',
			value:
				`Status: **${evaluation.status}**\n` +
				`Completion Rate: **${evaluation.completionRate}%**\n` +
				`Completed: **${evaluation.completed}**\n` +
				`Canceled: **${evaluation.canceled}**\n` +
				`Total NC: **${formatNumber(evaluation.totalNC)}**\n` +
				`Penalty Points: **${evaluation.totalPenalty}**`,
		});
	}

	return embed;
}

// =====================
// DROPDOWN BUILDER
// =====================
function buildProfileDropdown(userId) {
	return new ActionRowBuilder().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId(`profile_menu_${userId}`)
			.setPlaceholder('Pilih halaman profile...')
			.addOptions([
				{
					label: 'Profile',
					description: 'Informasi driver',
					value: 'profile',
				},
				{
					label: 'Wallet',
					description: 'Total currency & riwayat',
					value: 'wallet',
				},
				{
					label: 'Point',
					description: 'Total penalty & riwayat',
					value: 'point',
				},
				{
					label: 'Pekerjaan Terakhir',
					description: '5 pekerjaan terakhir',
					value: 'recent_jobs',
				},
			]),
	);
}

// =====================
// WALLET EMBED
// =====================
function buildWalletEmbed({ user, profile }) {
	const history = profile.walletHistory || [];

	const historyText = history
		.slice(0, 6)
		.map(
			(t) =>
				`• **${
					t.amount > 0 ? '🟢 +' : '🔴 -'
				}${Math.abs(t.amount)} N¢** — ${t.reason}\n(oleh: <@${t.managerId}>, <t:${Math.floor(
					new Date(t.createdAt).getTime() / 1000,
				)}:f>`,
		)
		.join('\n');

	return new EmbedBuilder()
		.setColor(0x00b894)
		.setTitle(`💰 Wallet - ${user.username}`)
		.addFields(
			{
				name: 'Total Currency (N¢)',
				value: `${profile.wallet || 0}`,
			},
			{
				name: 'Riwayat (6 Terakhir)',
				value: historyText || 'Belum ada transaksi.',
			},
		);
}

// =====================
// POINT EMBED
// =====================
function buildPointEmbed({ user, profile }) {
	const history = profile.pointHistory || [];

	const historyText = history
		.slice(0, 6)
		.map((h) => {
			const date = `<t:${Math.floor(h.createdAt.getTime() / 1000)}:f>`;
			const sign = h.type === 'add' ? '➕' : '➖';
			return `${sign} **${h.points}** poin — ${h.reason}\n*(oleh <@${h.managerId}>, ${date})*`;
		})
		.join('\n');

	return new EmbedBuilder()
		.setColor(0xe17055)
		.setTitle(`⚠️ Point - ${user.username}`)
		.addFields(
			{
				name: 'Total Penalty Point',
				value: `${profile.penaltyPoint || 0}`,
			},
			{
				name: 'Riwayat (6 Terakhir)',
				value: historyText || 'Belum ada riwayat penalty.',
			},
		);
}

/* ============================= */
/* RECENT JOB PAGE */
/* ============================= */
function buildRecentJobsEmbed({ user, profile }) {
	const embed = new EmbedBuilder()
		.setColor(0x5865f2)
		.setTitle(`🚛 Pekerjaan Terakhir - ${user.username}`)
		.setTimestamp();

	if (!profile.recentJobs || profile.recentJobs.length === 0) {
		embed.setDescription('Belum ada riwayat pekerjaan.');
		return embed;
	}

	profile.recentJobs.forEach((job, index) => {
		const statusIcon =
			job.jobStatus === 'COMPLETED'
				? '✅'
				: job.jobStatus === 'CANCELED'
					? '❌'
					: '⏳';

		embed.addFields({
			name: `📦 Job ${index + 1}`,
			value:
				`**Job ID:** ${job.jobId}\n` +
				`**Game:** ${job.game}\n` +
				`**Status:** ${statusIcon} ${job.jobStatus}\n` +
				`**Route:** ${job.sourceCompany} (${job.sourceCity}) → ${job.destinationCompany} (${job.destinationCity})\n` +
				`**Cargo:** ${job.cargoName} (${formatNumber(job.cargoMass)} t)`,
		});
	});

	return embed;
}

module.exports = {
	buildProfileEmbed,
	buildWalletEmbed,
	buildPointEmbed,
	buildRecentJobsEmbed,
};
