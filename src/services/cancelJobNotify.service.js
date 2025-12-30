const { EmbedBuilder } = require('discord.js');
const GuildSettings = require('../models/guildsetting');

async function notifyPointResult({
	client,
	guildId,
	userId,
	type, // 'reward' | 'penalty'
	points,
	reason,
	jobId,
}) {
	const guild = await client.guilds.fetch(guildId).catch(() => null);
	if (!guild) return;

	const member = await guild.members.fetch(userId).catch(() => null);

	/* =====================
	   DRIVER DM
	===================== */
	if (member) {
		const embed = new EmbedBuilder()
			.setTitle(
				type === 'reward'
					? '✅ Job Completed'
					: '⚠️ Job Canceled',
			)
			.setDescription(
				type === 'reward'
					? `Kamu mendapatkan **${points} NC**`
					: `Kamu mendapatkan **${points} poin penalti**`,
			)
			.addFields(
				{ name: 'Job ID', value: `#${jobId}`, inline: true },
				{ name: 'Alasan', value: reason, inline: false },
			)
			.setColor(type === 'reward' ? 0x2ecc71 : 0xe74c3c)
			.setTimestamp();

		await member.send({ embeds: [embed] }).catch(() => null);
	}

	/* =====================
	   MANAGER LOG CHANNEL
	===================== */
	const settings = await GuildSettings.findOne({ guildId });
	if (!settings?.channelLog) return;

	const logChannel = await guild.channels
		.fetch(settings.channelLog)
		.catch(() => null);

	if (!logChannel) return;

	const logEmbed = new EmbedBuilder()
		.setTitle(
			type === 'reward'
				? '📊 Job Reward Issued'
				: '📊 Job Penalty Issued',
		)
		.addFields(
			{
				name: 'Driver',
				value: `<@${userId}>`,
				inline: true,
			},
			{
				name: 'Job ID',
				value: `#${jobId}`,
				inline: true,
			},
			{
				name: type === 'reward' ? 'NC' : 'Penalty',
				value: String(points),
				inline: true,
			},
			{
				name: 'Reason',
				value: reason,
			},
		)
		.setColor(type === 'reward' ? 0x3498db : 0xf39c12)
		.setTimestamp();

	await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
}

module.exports = {
	notifyPointResult,
};
