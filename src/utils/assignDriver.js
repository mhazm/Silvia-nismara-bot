const Point = require('../models/points');
const PointHistory = require('../models/pointhistory');
const DriverLink = require('../models/driverlink');
const GuildSettings = require('../models/guildsetting');

module.exports = async function assignDriver({
	client,
	guild,
	executor,
	targetMember,
}) {
	const settings = await GuildSettings.findOne({ guildId: guild.id });
	if (!settings) throw new Error('Guild settings not found');

	const magangRoles = settings.roles?.magang || [];
	const driverRoles = settings.roles?.driver || [];

	// ❌ Proteksi: sudah driver
	if (targetMember.roles.cache.some(r => driverRoles.includes(r.id))) {
		throw new Error('User sudah berstatus Driver');
	}

	// 🔍 Ambil data driver (berdasarkan userId, bukan nama)
	const driverLink = await DriverLink.findOne({
		guildId: guild.id,
		userId: targetMember.id,
	});

	if (!driverLink) {
		throw new Error('Driver belum terdaftar di sistem');
	}

	// 🔁 Hapus role magang
	for (const roleId of magangRoles) {
		if (targetMember.roles.cache.has(roleId)) {
			await targetMember.roles.remove(roleId);
		}
	}

	// ✅ Tambah role driver
	for (const roleId of driverRoles) {
		if (!targetMember.roles.cache.has(roleId)) {
			await targetMember.roles.add(roleId);
		}
	}

	// 🔢 Reset poin jika ada
	const pointData = await Point.findOne({
		guildId: guild.id,
		userId: targetMember.id,
	});

	let removedPoints = null;

	if (pointData && pointData.totalPoints > 0) {
		removedPoints = pointData.totalPoints;

		await Point.updateOne(
			{ guildId: guild.id, userId: targetMember.id },
			{ $set: { totalPoints: 0 } },
		);

		await PointHistory.create({
			guildId: guild.id,
			userId: targetMember.id,
			managerId: executor.id,
			points: removedPoints,
			type: 'remove',
			reason: 'Reset poin setelah diangkat menjadi Driver',
		});
	}

	// 📩 DM ke user
	await targetMember.send({
		content:
			`🎉 **Selamat ${driverLink.truckyName}!**\n\n` +
			`Kamu resmi diangkat menjadi **Driver**.\n` +
			(removedPoints !== null
				? `🧹 Poin penalty kamu telah direset menjadi **0**.`
				: `✅ Kamu tidak memiliki poin penalty sebelumnya.`),
	}).catch(() => {});

	// 📢 Log ke channel
	if (settings.channelLog) {
		const logChannel = guild.channels.cache.get(settings.channelLog);
		if (logChannel) {
			logChannel.send({
				content:
					`✅ **ASSIGN DRIVER**\n` +
					`👤 Driver : <@${targetMember.id}> (${driverLink.truckyName})\n` +
					`🧑‍💼 Executor : <@${executor.id}>\n` +
					(removedPoints !== null
						? `🧹 Reset Poin : ${removedPoints}`
						: `🧾 Tidak ada poin untuk direset`),
			});
		}
	}

	return {
		truckyName: driverLink.truckyName,
		removedPoints,
	};
};