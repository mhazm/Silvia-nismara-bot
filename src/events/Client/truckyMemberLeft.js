const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const DriverLink = require('../../models/driverlink');
const Currency = require('../../models/currency');
const Point = require('../../models/points');
const GuildSettings = require('../../models/guildsetting');

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
			// VALIDASI EMBED
			// =========================
			if (!embed.title || !embed.title.includes('Member Left')) return;
			if (!embed.url) return;

			// =========================
			// AMBIL TRUCKY ID DARI URL
			// =========================
			const urlMatch = embed.url.match(/\/user\/(\d+)/);
			if (!urlMatch) return;

			const truckyId = Number(urlMatch[1]);
			console.log(`🚪 Trucky Member Left | ID: ${truckyId}`);

			// =========================
			// CARI DRIVER (BERDASARKAN ID)
			// =========================
			const driver = await DriverLink.findOne({ guildId, truckyId });

			if (!driver) {
				console.log(`⚠️ Driver Trucky ID ${truckyId} tidak ditemukan.`);
				return;
			}

			const userId = driver.userId;

			// =========================
			// HAPUS DATA DATABASE
			// =========================
			await Promise.all([
				DriverLink.deleteOne({ _id: driver._id }),
				Currency.deleteOne({ guildId, userId }),
				Point.deleteOne({ guildId, userId }),
			]);

			console.log(`🗑️ Data driver ${driver.truckyName} dihapus:
- DriverLink
- Currency
- Point`);

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
			const logChannelId = settings.channels?.channelLog;
			if (!logChannelId) return;

			const notifyChannel =
				message.guild.channels.cache.get(logChannelId);
			if (!notifyChannel) return;

			const managerRoles = settings.roles?.manager || [];
			const mentions = managerRoles.map((id) => `<@&${id}>`).join(' ');

			const notifyEmbed = new EmbedBuilder()
				.setTitle('🚪 Driver Keluar dari Trucky Company')
				.setColor('Red')
				.setDescription(
					'Driver terdeteksi **keluar dari Trucky Company**.\nSemua data & role Discord telah dibersihkan.',
				)
				.addFields(
					{
						name: '🚛 Trucky Name',
						value: driver.truckyName,
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
						name: '🗑️ Database Dihapus',
						value: 'DriverLink, Currency, Point',
					},
					{
						name: '🧹 Role Dicabut',
						value:
							removedRoles.length > 0
								? removedRoles
										.map((id) => `<@&${id}>`)
										.join(', ')
								: 'Tidak ada',
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
