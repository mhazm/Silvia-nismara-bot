const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const DriverLink = require('../../models/driverlink');
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
			if (!settings || !settings.memberWatcherChannel) return;
			if (message.channel.id !== settings.memberWatcherChannel) return;

			const embed = message.embeds[0];

			// =========================
			// CEK EMBED "MEMBER LEFT"
			// =========================
			if (!embed.title || !embed.title.includes('Member Left')) return;
			if (!embed.description) return;

			// "numlock has left the Company"
			const match = embed.description.match(/^(.+?)\s+has left/i);
			if (!match) return;

			const truckyName = match[1].trim();
			console.log(`🚪 Trucky Member Left: ${truckyName}`);

			// =========================
			// CARI DRIVER
			// =========================
			const driver = await DriverLink.findOne({
				guildId,
				truckyName: { $regex: `^${truckyName}$`, $options: 'i' },
			});

			if (!driver) {
				console.log(`⚠️ Driver "${truckyName}" tidak ditemukan.`);
				return;
			}

			// =========================
			// HAPUS DRIVER DARI DB
			// =========================
			await DriverLink.deleteOne({ _id: driver._id });
			console.log(`🗑️ Driver ${driver.truckyName} dihapus dari database.`);

			// =========================
			// REMOVE ROLE DISCORD
			// =========================
			let removedRoles = [];

			const member = await message.guild.members
				.fetch(driver.userId)
				.catch(() => null);

			if (member) {
				const driverRoles = settings.roles?.driver || [];
				const magangRoles = settings.roles?.magang || [];

				const rolesToRemove = [...driverRoles, ...magangRoles].filter(
					(roleId) => member.roles.cache.has(roleId),
				);

				if (rolesToRemove.length > 0) {
					await member.roles.remove(rolesToRemove);
					removedRoles = rolesToRemove;
				}
			}

			// =========================
			// NOTIFIKASI KE MANAJEMEN
			// =========================
			if (!settings.channels?.channelLog) return;

			const managerRoles = settings.roles?.manager || [];
			if (!managerRoles.length) return;

			const notifyChannel = message.guild.channels.cache.get(
				settings.channels.channelLog,
			);
			if (!notifyChannel) return;

			const roleMentions = managerRoles
				.map((id) => `<@&${id}>`)
				.join(' ');

			const notifyEmbed = new EmbedBuilder()
				.setTitle('🚪 Driver Keluar dari Trucky Company')
				.setColor('Red')
				.setDescription(
					'Driver telah meninggalkan **Trucky Company**.\nData dihapus dan role Discord disesuaikan.',
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
						value: `<@${driver.userId}>`,
						inline: true,
					},
					{
						name: '🧹 Role Dicabut',
						value:
							removedRoles.length > 0
								? removedRoles.map((id) => `<@&${id}>`).join(', ')
								: 'Tidak ada role yang perlu dicabut',
					},
				)
				.setTimestamp();

			await notifyChannel.send({
				content: roleMentions,
				embeds: [notifyEmbed],
			});
		} catch (err) {
			console.error('❌ truckyMemberLeft watcher error:', err);
		}
	},
}).toJSON();