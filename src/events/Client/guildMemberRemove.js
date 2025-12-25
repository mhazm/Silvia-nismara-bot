const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const DriverRegistry = require('../../models/driverlink');
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

			// 🔍 Cari driver berdasarkan Discord ID
			const driver = await DriverRegistry.findOne({ guildId, userId });
			if (!driver) return;

			// 🗑️ Hapus data driver
			await DriverRegistry.deleteOne({ _id: driver._id });

			// ⚙️ Ambil settings guild
			const settings = await GuildSettings.findOne({ guildId });
			if (!settings?.channels?.channelLog) return;

			const managerRoles = settings.roles?.manager || [];
			if (!managerRoles.length) return;

			const notifyChannel = member.guild.channels.cache.get(
				settings.channels.channelLog,
			);
			if (!notifyChannel) return;

			const roleMentions = managerRoles
				.map((id) => `<@&${id}>`)
				.join(' ');

			// 📢 Embed notifikasi
			const embed = new EmbedBuilder()
				.setTitle('🚪 Driver Keluar Server')
				.setColor('Red')
				.setThumbnail(member.user.displayAvatarURL())
				.setDescription(
					'Driver telah meninggalkan server dan data mereka otomatis dihapus dari sistem.',
				)
				.addFields(
					{
						name: '👤 Discord User',
						value: `<@${userId}> (${member.user.tag})`,
						inline: true,
					},
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
				)
				.setTimestamp();

			await notifyChannel.send({
				content: roleMentions,
				embeds: [embed],
			});

			console.log(
				`🗑️ Driver ${driver.truckyName} (${userId}) keluar server, data dihapus.`,
			);
		} catch (err) {
			console.error('❌ guildMemberRemove error:', err);
		}
	},
}).toJSON();