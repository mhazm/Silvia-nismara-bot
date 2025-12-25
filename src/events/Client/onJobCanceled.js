const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');
const DriverRegistry = require('../../models/driverlink');
const GuildSettings = require('../../models/guildsetting');

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			// =========================
			// VALIDASI DASAR
			// =========================
			if (!message.guild) return;

			const settings = await GuildSettings.findOne({
				guildId: message.guild.id,
			});
			if (!settings || !settings.truckyWebhookChannel) return;
			if (message.channel.id !== settings.truckyWebhookChannel) return;

			if (!message.webhookId) return;
			if (!message.embeds?.length) return;

			const embed = message.embeds[0];

			// =========================
			// DETEKSI JOB CANCELED
			// =========================
			if (!embed.title || !embed.title.includes('Job Canceled')) return;

			const match = embed.title.match(/#(\d+)/);
			if (!match) return;

			const jobId = match[1];
			const guildId = message.guild.id;

			console.log(`❌ Job Canceled detected: #${jobId}`);

			// =========================
			// AMBIL NAMA DRIVER DARI EMBED
			// (biasanya ada di author / footer / description)
			// =========================
			const driverName =
				embed.author?.name ||
				embed.footer?.text ||
				null;

			if (!driverName) {
				console.log('⚠️ Driver name tidak ditemukan di embed.');
				return;
			}

			const driver = await DriverRegistry.findOne({
				guildId,
				truckyName: { $regex: `^${driverName}$`, $options: 'i' },
			});

			if (!driver) {
				console.log('⚠️ Driver belum ter-register, skip penalty.');
				return;
			}

			const discordId = driver.userId;
			const PENALTY_POINTS = 5;

			// =========================
			// UPDATE POINT PENALTY
			// =========================
			const prevPointData = await Point.findOne({
				guildId,
				userId: discordId,
			});

			const prevTotal = prevPointData?.totalPoints || 0;

			const updatedPoint = await Point.findOneAndUpdate(
				{ guildId, userId: discordId },
				{ $inc: { totalPoints: PENALTY_POINTS } },
				{ upsert: true, new: true },
			);

			await PointHistory.create({
				guildId,
				userId: discordId,
				managerId: __client__.user.id,
				points: PENALTY_POINTS,
				type: 'add',
				reason: `Job Canceled — Job #${jobId}`,
			});

			console.log(
				`⚠️ Penalty applied: +${PENALTY_POINTS} points to ${driverName}`,
			);

			// =========================
			// LOG KE CHANNEL (OPTIONAL)
			// =========================
			if (settings.channelLog) {
				const logChannel = message.guild.channels.cache.get(
					settings.channelLog,
				);

				if (logChannel) {
					const logEmbed = new EmbedBuilder()
						.setTitle('❌ Job Canceled Penalty')
						.setColor('DarkRed')
						.setDescription(
							`Driver: <@${discordId}>\n` +
							`Job ID: **#${jobId}**\n\n` +
							`Penalty Diberikan: **${PENALTY_POINTS} points**\n` +
							`Total Penalty Saat Ini: **${updatedPoint.totalPoints} points**`,
						)
						.setTimestamp()
						.setThumbnail(
							message.guild.iconURL({ forceStatic: false }),
						);

					logChannel.send({ embeds: [logEmbed] });
				}
			}

			// =========================
			// DM KE DRIVER (OPTIONAL)
			// =========================
			const userEmbed = new EmbedBuilder()
				.setTitle('❌ Job Dibatalkan')
				.setColor('Red')
				.setDescription(
					`Job **#${jobId}** terdeteksi **dibatalkan**.\n\n` +
					`Kamu menerima **${PENALTY_POINTS} penalty points**.\n` +
					`Total penalty kamu sekarang: **${updatedPoint.totalPoints} points**.`,
				)
				.setTimestamp();

			__client__.users.send(discordId, { embeds: [userEmbed] }).catch(() => {});

		} catch (err) {
			console.error('❌ Job Canceled penalty error:', err);
		}
	},
}).toJSON();