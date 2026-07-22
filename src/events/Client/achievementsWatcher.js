const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const driverData = require('../../models/driverlink');
const GuildSettings = require('../../models/guildsetting');
const achievementData = require('../../models/achievement');
const userAchievementData = require('../../models/userAchievement');

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			if (!message.guild) return;

			const settings = await GuildSettings.findOne({
				guildId: message.guild.id,
			});
			if (!settings || !settings.achievementChannel) return;
			if (message.channel.id !== settings.achievementChannel) return;

			if (!message.webhookId && message.author.id !== __client__.user.id)
				return;
			if (!message.embeds?.length) return;

			const embed = message.embeds[0];
			const description = embed.description;
			const profileUrl = embed.author?.url;

			if (!description) return;

			const achievementMatch = description.match(
				/reached the achievement `(.+?)`/,
			);

			const profileMatch = profileUrl.match(/\/user\/([a-zA-Z0-9-_]+)/);

			if (!achievementMatch || !profileMatch) {
				console.log(
					`❌ Achievement match failed: ${achievementMatch}, Profile match failed: ${profileMatch}`,
				);
				return;
			}

			const achievement = achievementMatch[1];
			const profile = profileMatch[1];

			console.log(`💎 Trucky Achievement: ${achievement}`);
			console.log(`💎 Trucky Profile: ${profile}`);

			const truckyDriver = await driverData.findOne({
				truckyId: profile,
			});
			console.log(
				`Match Driver: ${truckyDriver.truckyId} | ${truckyDriver.truckyName}`,
			);

			if (!truckyDriver) {
				console.log('⚠️ Driver belum terdaftar di database, Skip.');
				return;
			}

			const manajerLogChannel = message.guild.channels.cache.get(
				settings.channelLog,
			);

			if (!manajerLogChannel) {
				console.log(
					'❌ Channel log manajer tidak ditemukan atau belum diatur.',
				);
			}

			const targetAchievement = await achievementData.findOne({
				name: achievement,
			});

			if (!targetAchievement) {
				console.log(
					`⚠️ Achievement '${achievement}' belum terdaftar di master database. Harap tambahkan dulu.`,
				);
				return;
			}

			await userAchievementData.create({
				discordId: truckyDriver.userId,
				truckyId: truckyDriver.truckyId,
				achievementId: targetAchievement._id,
				remarks: `Otomatis direkam dari Trucky Webhook`,
			});

			console.log(
				`✅ Berhasil mencatat achievement ${targetAchievement.name} untuk user ${truckyDriver.truckyName}`,
			);

			if (manajerLogChannel) {
				const logEmbed = new EmbedBuilder()
					.setTitle('🏆 Achievement Driver Terdeteksi!')
					.setColor('Gold')
					.setDescription(
						`Sistem berhasil mencatat pencapaian baru untuk driver kita.`,
					)
					.addFields(
						{
							name: '👤 Driver',
							value: `<@${truckyDriver.userId}> (${truckyDriver.truckyName})`,
							inline: true,
						},
						{
							name: '🏅 Achievement',
							value: `**${targetAchievement.name}**`,
							inline: true,
						},
						{
							name: '🏷️ Kategori',
							// Pastikan schema master kamu punya field category (weekly/monthly/dsb)
							value: targetAchievement.category
								? targetAchievement.category.toUpperCase()
								: 'UMUM',
							inline: true,
						},
					)
					.setFooter({ text: 'Nismara Transport Achievement System' })
					.setTimestamp();

				manajerLogChannel.send({ embeds: [logEmbed] }).catch(() => {
					console.log(
						'❌ Gagal mengirim embed ke channel log manajer.',
					);
				});
			}
		} catch (err) {
			console.error('❌ Error pada achievementsWatcher:', err);
		}
	},
}).toJSON();
