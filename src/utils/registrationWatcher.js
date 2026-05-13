const Registration = require('../models/Registration');
const {
	EmbedBuilder,
	ChannelType,
	PermissionFlagsBits,
} = require('discord.js');

module.exports = async function registrationWatcher(client) {
	console.log('🔄 Registration Watcher started...');

	const changeStream = Registration.watch();

	changeStream.on('change', async (change) => {
		// Hanya proses jika ada data baru (insert)
		if (change.operationType === 'insert') {
			const data = change.fullDocument;
			const guildId = '1298888060108542017';
			const guild = client.guilds.cache.get(guildId);
			// const guild = client.guilds.cache.get(data.guildId);
			if (!guild) return;

			// ID Kategori Recruitment (Bisa diambil dari guildsettings atau hardcode)
			const categoryId = '1333622448599334943';
			const staffRoleId = '1333622587749564619';

			try {
				// 1. Buat Channel Ticket Otomatis
				const channel = await guild.channels.create({
					name: `pendaftaran-${data.username}`,
					type: ChannelType.GuildText,
					parent: categoryId,
					permissionOverwrites: [
						{
							id: guild.id,
							deny: [PermissionFlagsBits.ViewChannel],
						},
						{
							id: data.userId,
							allow: [
								PermissionFlagsBits.ViewChannel,
								PermissionFlagsBits.SendMessages,
							],
						},
						{
							id: staffRoleId,
							allow: [
								PermissionFlagsBits.ViewChannel,
								PermissionFlagsBits.SendMessages,
							],
						},
					],
				});

				// 2. Kirim Embed Summary ke dalam Ticket
				const embed = new EmbedBuilder()
					.setTitle('📋 Pendaftaran Driver Baru (Web)')
					.setColor('#6D28D9') // Warna Ungu Nismara
					.setThumbnail(client.user.displayAvatarURL())
					.addFields(
						{
							name: 'Driver',
							value: `<@${data.userId}>`,
							inline: true,
						},
						{
							name: 'Trucky ID',
							value: data.truckyId,
							inline: true,
						},
						{ name: 'Prefer Game', value: data.game },
						{ name: 'Experience Bermain', value: data.experience },
						{
							name: 'Sumber Mengetahui Nismara',
							value: data.sumber,
						},
						{ name: 'Alasan Bergabung', value: data.reason },
					)
					.setFooter({ text: 'Nismara Recruitment System' })
					.setTimestamp();

				await channel.send({
					content: `Halo <@${data.userId}> & <@&${staffRoleId}>, pendaftaran dari website telah diterima!`,
					embeds: [embed],
				});

				// 3. Simpan Channel ID ke DB agar staff bisa approve lewat web nantinya
				await Registration.findByIdAndUpdate(data._id, {
					channelId: channel.id,
				});
			} catch (err) {
				console.error('Gagal membuat ticket otomatis:', err);
			}
		}
	});
};
