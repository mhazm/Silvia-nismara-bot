const { EmbedBuilder } = require('discord.js');

/**
 * Helper format angka
 */
function formatNumber(number = 0) {
	return number.toLocaleString('id-ID');
}

/**
 * Helper format tanggal
 */
function formatDate(date) {
	if (!date) return '-';
	return new Date(date).toLocaleDateString('id-ID', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
	});
}

/**
 * Build profile embed
 */
function buildProfileEmbed({ user, member, profile }) {
	const {
		currency,
		penaltyPoints,
		totalJobs,
		specialJobs,
		canceledJobs,
		recentJobs,
	} = profile;

	// Tentukan role utama (Sopir / Magang)
	const roleName =
		member.roles.cache.find((r) => r.name.toLowerCase().includes('sopir'))
			?.name ||
		member.roles.cache.find((r) => r.name.toLowerCase().includes('magang'))
			?.name ||
		'Driver';

	// Warna embed berdasarkan role
	const embedColor = roleName.toLowerCase().includes('magang')
		? 0x4db6ff
		: 0xc8a2c8;

	// Recent job formatting
	const recentJobText = recentJobs.length
		? recentJobs
				.map((job) => {
					const statusIcon = job.status === 'completed' ? '✅' : '❌';
					return `${statusIcon} #${job.jobId}`;
				})
				.join('\n')
		: 'Belum ada data job';

	const embed = new EmbedBuilder()
		.setColor(embedColor)
		.setTitle('👤 Driver Profile')
		.setDescription('**Nismara Transport**\nVirtual Trucking Company')
		.setThumbnail(user.displayAvatarURL({ dynamic: true }))
		.addFields(
			{
				name: '🔹 Informasi Dasar',
				value: [
					`**Discord:** <@${user.id}>`,
					`**Role:** ${roleName}`,
				].join('\n'),
			},
			{
				name: '💰 Statistik Internal',
				value: [
					`**Currency:** ${formatNumber(currency)} NC`,
					`**Total Job:** ${totalJobs}`,
					`**Special Job:** ${specialJobs}`,
					`**Job Dibatalkan:** ${canceledJobs}`,
					`**Poin Penalti:** ${penaltyPoints}`,
				].join('\n'),
			},
		)
		.setFooter({
			text: 'Nismara Transport by Nismara Group',
		})
		.setTimestamp();

	if (profile.trucky) {
		embed.addFields({
			name: '🚛 Statistik Trucky',
			value: [
				`**Nama:** ${profile.trucky.username}`,
				`**Role:** ${profile.trucky.role ?? '-'}`,
				`**Distance:** ${formatNumber(profile.trucky.distance)} km`,
				`**Cargo Mass:** ${formatNumber(profile.trucky.cargomass)} t`,
				`**Last Activity:** ${formatDate(profile.trucky.lastActivity)}`,
				`**Status:** ${
					profile.trucky.inactive ? '🔴 Inactive' : '🟢 Active'
				}`,
			].join('\n'),
		});

		embed.addFields({
			name: '📜 Recent Job',
			value: recentJobText,
		});

		if (evaluation) {
			embed.addFields({
				name: '📊 Driver Evaluation (Manager Only)',
				value:
					`Status: **${evaluation.status}**\n` +
					`Completion Rate: **${evaluation.completionRate}%**\n` +
					`Completed: **${evaluation.completed}**\n` +
					`Canceled: **${evaluation.canceled}**\n` +
					`Total NC: **${evaluation.totalNC}**\n` +
					`Penalty Points: **${evaluation.totalPenalty}**`,
			});
		}
	} else if (!profile.driverLink) {
		embed.addFields({
			name: '🚛 Trucky',
			value: '⚠️ Akun Trucky belum ditautkan ke Discord.',
		});
	}

	return embed;
}

module.exports = {
	buildProfileEmbed,
};
