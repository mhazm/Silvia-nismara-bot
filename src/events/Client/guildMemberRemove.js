const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const DriverLink = require('../../models/driverlink');
const Users = require('../../models/Users');
const GuildSettings = require('../../models/guildsetting');

module.exports = new Event({
	event: 'guildMemberRemove',
	once: false,
	/**
	 * @param {import('discord.js').GuildMember} member
	 */
	run: async (__client__, member) => {
		try {
			if (!member.guild) return;

			const guildId = member.guild.id;
			const userId = member.user.id;

			// ⚙️ Ambil settings guild
			const settings = await GuildSettings.findOne({ guildId });
			const logChannelId =
				settings?.channelLog || settings?.memberWatcherChannel;
			if (!logChannelId) return;

			// 🔍 Cek data di database (DriverLink & Users)
			const [driver, userData] = await Promise.all([
				DriverLink.findOne({ guildId, userId }),
				Users.findOne({ discordId: userId }),
			]);

			// Cek apakah user memiliki role Driver atau Magang di server
			const driverRoles = settings.roles?.driver || [];
			const magangRoles = settings.roles?.magang || [];

			const hasDriverRole =
				member.roles?.cache?.some((r) => driverRoles.includes(r.id)) ||
				Boolean(driver) ||
				Boolean(userData?.isDriver);

			const hasMagangRole =
				member.roles?.cache?.some((r) => magangRoles.includes(r.id)) ||
				userData?.truckyRole?.toLowerCase() === 'intern' ||
				userData?.truckyRole?.toLowerCase() === 'magang';

			// Jika bukan Driver dan bukan Anak Magang, abaikan (guest biasa)
			if (!hasDriverRole && !hasMagangRole && !driver && !userData) {
				return;
			}

			// Tentukan status keanggotaan
			let statusLabel = 'Driver / Anggota';
			if (hasDriverRole && hasMagangRole) {
				statusLabel = 'Driver & Anak Magang (Intern)';
			} else if (hasDriverRole) {
				statusLabel = '🚛 Official Driver';
			} else if (hasMagangRole) {
				statusLabel = '🎓 Anak Magang (Intern)';
			}

			// Ambil channel log menggunakan fetch (fallback ke cache)
			const notifyChannel =
				(await member.guild.channels
					.fetch(logChannelId)
					.catch(() => null)) ||
				member.guild.channels.cache.get(logChannelId);

			if (!notifyChannel) {
				console.warn(
					`[guildMemberRemove] Channel log ID ${logChannelId} tidak ditemukan.`,
				);
				return;
			}

			const managerRoles = settings.roles?.manager || [];
			const roleMentions = managerRoles.length
				? managerRoles.map((id) => `<@&${id}>`).join(' ')
				: '';

			const truckyName =
				driver?.truckyName || userData?.name || member.user.username;
			const truckyId =
				driver?.truckyId || userData?.truckyId || 'Tidak Tercatat';

			// 📢 Embed notifikasi darurat / keselamatan untuk manajer
			const embed = new EmbedBuilder()
				.setTitle('🚨 SAFETY ALERT: Driver / Intern Meninggalkan Server!')
				.setColor('#FF0000') // Red alert
				.setThumbnail(
					member.user.displayAvatarURL({ dynamic: true, size: 256 }),
				)
				.setDescription(
					`⚠️ Anggota dengan status **${statusLabel}** terdeteksi **keluar / meninggalkan server Discord Nismara Transport**.\n\n` +
						`📌 **Aturan & SOP Nismara:**\n` +
						`Seluruh Driver dan Anak Magang **wajib berada di dalam server Discord** selama aktif terdaftar. Mohon tim Manajemen segera menindaklanjuti status akun yang bersangkutan di Trucky Company / Discord.`,
				)
				.addFields(
					{
						name: '👤 Akun Discord',
						value: `<@${userId}> (${member.user.tag || member.user.username})\n\`ID: ${userId}\``,
						inline: true,
					},
					{
						name: '🏷️ Status Keanggotaan',
						value: `**${statusLabel}**`,
						inline: true,
					},
					{
						name: '🚛 Data Trucky',
						value: `• **Nama:** ${truckyName}\n• **Trucky ID:** \`${truckyId}\``,
						inline: false,
					},
				)
				.setFooter({
					text: 'Sistem Keamanan & Monitoring Anggota Nismara',
				})
				.setTimestamp();

			if (userData) {
				embed.addFields({
					name: '📊 Profil Tambahan di Database',
					value: `• **Level / XP:** Level ${userData.level || 0} (${userData.xp || 0} XP)\n• **Status Cuti:** ${userData.isOnLeave ? 'Sedang Cuti' : 'Aktif'}`,
					inline: false,
				});
			}

			await notifyChannel.send({
				content: roleMentions
					? `⚠️ **Perhatian Manajemen:** ${roleMentions}`
					: undefined,
				embeds: [embed],
			});

			console.log(
				`🚨 [SAFETY ALERT] ${statusLabel} ${truckyName} (${userId}) keluar dari server Discord! Notifikasi telah dikirim ke channel ${notifyChannel.name || logChannelId}.`,
			);
		} catch (err) {
			console.error('❌ guildMemberRemove error:', err);
		}
	},
}).toJSON();