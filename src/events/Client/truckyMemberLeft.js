const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const DriverLink = require('../../models/driverlink');
const GuildSettings = require('../../models/guildsetting');

// Set untuk mencegah eksekusi ganda saat Trucky mengirim 'Member Kicked' & 'Member Left' berurutan
const processingTruckyIds = new Set();

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			// =========================
			// VALIDASI AWAL
			// =========================
			if (!message.guild) return;
			if (!message.webhookId) return;
			if (!message.embeds?.length) return;

			const guildId = message.guild.id;

			const settings = await GuildSettings.findOne({ guildId });
			if (!settings?.memberWatcherChannel) return;
			if (message.channel.id !== settings.memberWatcherChannel) return;

			const embed = message.embeds[0];

			// =========================
			// VALIDASI EMBED TITLE (FIXED LOGIC)
			// =========================
			if (!embed.title) return;
			const isMemberLeft = embed.title.includes('Member Left');
			const isMemberKicked = embed.title.includes('Member Kicked');
			if (!isMemberLeft && !isMemberKicked) return;
			if (!embed.url) return;

			// =========================
			// AMBIL TRUCKY ID DARI URL
			// =========================
			const urlMatch = embed.url.match(/\/user\/(\d+)/);
			if (!urlMatch) return;

			const truckyId = Number(urlMatch[1]);

			// Cegah eksekusi ganda jika Trucky mengirim 'Member Kicked' dan 'Member Left' bersamaan
			if (processingTruckyIds.has(truckyId)) {
				console.log(
					`⏳ Trucky ID ${truckyId} sedang/sudah diproses, mengabaikan webhook duplikat.`,
				);
				return;
			}
			processingTruckyIds.add(truckyId);
			setTimeout(() => processingTruckyIds.delete(truckyId), 10000);
			const actionType = isMemberKicked ? 'Kicked' : 'Left';
			console.log(`🚪 Trucky Member ${actionType} | ID: ${truckyId}`);

			// =========================
			// CARI DRIVER (BERDASARKAN ID)
			// =========================
			const driver = await DriverLink.findOne({ guildId, truckyId });

			if (!driver) {
				console.log(
					`⚠️ Driver Trucky ID ${truckyId} tidak ditemukan di DriverLink.`,
				);
				return;
			}

			const userId = driver.userId;

			// ============================================
			// EKSEKUSI PURGE LENGKAP VIA WEB API
			// ============================================
			const webUrl =
				process.env.WEB_URL || 'https://transport.nismara.web.id';
			let purgeDetails = null;

			try {
				const purgeResponse = await fetch(
					`${webUrl}/api/manage/users/${userId}/purge`,
					{
						method: 'DELETE',
						headers: {
							Authorization: `Bearer ${process.env.NISMARA_SECRET_API}`,
						},
					},
				);

				if (purgeResponse.ok) {
					purgeDetails = await purgeResponse.json();
					console.log(
						`✅ [PURGE SUCCESS] User ${userId} (${driver.truckyName}) berhasil di-purge total:`,
						purgeDetails,
					);
				} else {
					const errData = await purgeResponse
						.json()
						.catch(() => ({}));
					console.error(
						`❌ [PURGE FAILED] Status ${purgeResponse.status}:`,
						errData,
					);
				}
			} catch (apiErr) {
				console.error('❌ Gagal menghubungi API Purge:', apiErr);
			}

			// =========================
			// REMOVE ROLE DISCORD
			// =========================
			let removedRoles = [];
			const member = await message.guild.members
				.fetch(userId)
				.catch(() => null);

			if (member) {
				const driverRoles = settings.roles?.driver || [];
				const magangRoles = settings.roles?.magang || [];

				const rolesToRemove = [...driverRoles, ...magangRoles].filter(
					(roleId) => member.roles.cache.has(roleId),
				);

				if (rolesToRemove.length) {
					await member.roles.remove(rolesToRemove);
					removedRoles = rolesToRemove;
				}
			}

			// =========================
			// NOTIFIKASI KE MANAJEMEN
			// =========================
			const logChannelId =
				settings?.channelLog || settings?.memberWatcherChannel;
			if (!logChannelId) return;

			const notifyChannel =
				(await message.guild.channels
					.fetch(logChannelId)
					.catch(() => null)) ||
				message.guild.channels.cache.get(logChannelId);
			if (!notifyChannel) return;

			const managerRoles = settings.roles?.manager || [];
			const mentions = managerRoles.map((id) => `<@&${id}>`).join(' ');

			const notifyEmbed = new EmbedBuilder()
				.setTitle(
					`🚪 Driver ${actionType === 'Kicked' ? 'Dikeluarkan (Kicked)' : 'Keluar (Left)'} dari Trucky`,
				)
				.setColor(actionType === 'Kicked' ? 'DarkRed' : 'Red')
				.setDescription(
					`Driver terdeteksi **${actionType === 'Kicked' ? 'dikeluarkan' : 'keluar'} dari Trucky Company**.\n` +
						(purgeDetails?.success
							? '✅ **Pembersihan Total:** Seluruh data akun, armada truk, slot garasi, transaksi, dan riwayat di web telah dimusnahkan tanpa sisa.'
							: '⚠️ **Catatan:** Role Discord dicabut. Verifikasi pembersihan data web secara manual jika API tidak merespons.'),
				)
				.addFields(
					{
						name: '🚛 Trucky Name',
						value: driver.truckyName || '-',
						inline: true,
					},
					{
						name: '🆔 Trucky ID',
						value: String(driver.truckyId),
						inline: true,
					},
					{
						name: '👤 Discord User',
						value: `<@${userId}>`,
						inline: true,
					},
					{
						name: '🗑️ Status Purge Web',
						value: purgeDetails?.success
							? `Tuntas (${purgeDetails.ownedFleetsDeleted || 0} Armada dihapus, ${purgeDetails.mediaFilesDeleted || 0} File media R2 dibersihkan)`
							: 'Gagal / Perlu cek manual',
						inline: false,
					},
					{
						name: '🧹 Role Dicabut',
						value:
							removedRoles.length > 0
								? removedRoles
										.map((id) => `<@&${id}>`)
										.join(', ')
								: 'Tidak ada role driver aktif',
						inline: false,
					},
				)
				.setTimestamp();

			await notifyChannel.send({
				content: mentions,
				embeds: [notifyEmbed],
			});
		} catch (err) {
			console.error('❌ truckyMemberLeft watcher error:', err);
		}
	},
}).toJSON();
