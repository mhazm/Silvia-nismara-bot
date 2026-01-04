const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot.js');
const ApplicationCommand = require('../../structure/ApplicationCommand.js');

const Point = require('../../models/points.js');
const PointHistory = require('../../models/pointhistory.js');
const Currency = require('../../models/currency.js');
const CurrencyHistory = require('../../models/currencyHistory.js');
const GuildSettings = require('../../models/guildsetting.js');

module.exports = new ApplicationCommand({
	command: {
		name: 'bayarpoin',
		description: 'Tebus penalty point menggunakan NC',
		type: 1,
		options: [
			{
				name: 'jumlah_poin',
				description: 'Jumlah penalty point yang ingin ditebus',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
		],
	},
	options: {
		allowedRoles: ['driver'],
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		try {
			const guildId = interaction.guild.id;
			const userId = interaction.user.id;
			const jumlahPoin =
				interaction.options.getInteger('jumlah_poin');

			const member = interaction.member;
			const displayName = member.displayName;

			// =========================
			// 1️⃣ Ambil settings guild
			// =========================
			const settings = await GuildSettings.findOne({ guildId });
			if (!settings) {
				return interaction.reply({
					content:
						'⚠️ Guild belum memiliki konfigurasi settings.',
					ephemeral: true,
				});
			}

			const costPerPoint = settings.pointPrice || 3000;

			// =========================
			// 2️⃣ Ambil data penalty
			// =========================
			const pointData = await Point.findOne({ guildId, userId });
			const totalPenalty = pointData?.totalPoints || 0;

			if (totalPenalty <= 0) {
				return interaction.reply({
					content:
						'❌ Kamu tidak memiliki penalty untuk ditebus.',
					ephemeral: true,
				});
			}

			if (jumlahPoin > totalPenalty) {
				return interaction.reply({
					content:
						`❌ Penalty kamu tidak mencukupi.\n` +
						`Penalty saat ini: **${totalPenalty} point**`,
					ephemeral: true,
				});
			}

			// =========================
			// 3️⃣ Ambil data NC
			// =========================
			const currency = await Currency.findOne({ guildId, userId });
			const totalNC = currency?.totalNC || 0;

			const totalCost = jumlahPoin * costPerPoint;

			if (totalNC < totalCost) {
				return interaction.reply({
					content:
						`❌ NC kamu tidak mencukupi.\n` +
						`Dibutuhkan **${totalCost} N¢**.\n` +
						`Saldo kamu saat ini: **${totalNC} N¢**`,
					ephemeral: true,
				});
			}

			// =========================
			// 4️⃣ Konfirmasi Button
			// =========================
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('confirm_tebus')
					.setLabel('✅ Ya, Tebus')
					.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
					.setCustomId('cancel_tebus')
					.setLabel('❌ Batal')
					.setStyle(ButtonStyle.Secondary),
			);

			await interaction.reply({
				content:
					`⚠️ **Konfirmasi Tebus Penalty**\n\n` +
					`Penalty ditebus : **${jumlahPoin} point**\n` +
					`Biaya           : **${totalCost} N¢**\n\n` +
					`Apakah kamu yakin?`,
				components: [row],
				ephemeral: true,
			});

			const message = await interaction.fetchReply();

			// =========================
			// 5️⃣ Collector Button
			// =========================
			const collector =
				message.createMessageComponentCollector({
					time: 20000,
				});

			collector.on('collect', async (i) => {
				if (i.user.id !== userId) {
					return i.reply({
						content:
							'❌ Tombol ini bukan untuk kamu.',
						ephemeral: true,
					});
				}

				collector.stop();

				// =========================
				// ❌ BATAL
				// =========================
				if (i.customId === 'cancel_tebus') {
					return i.update({
						content:
							'❌ Tebus penalty telah dibatalkan.',
						components: [],
					});
				}

				// =========================
				// 6️⃣ FINAL CHECK (AMAN)
				// =========================
				const freshPoint = await Point.findOne({
					guildId,
					userId,
				});
				const freshCurrency = await Currency.findOne({
					guildId,
					userId,
				});

				if (
					!freshPoint ||
					freshPoint.totalPoints < jumlahPoin ||
					!freshCurrency ||
					freshCurrency.totalNC < totalCost
				) {
					return i.update({
						content:
							'❌ Data berubah. Penalty atau NC kamu tidak mencukupi.',
						components: [],
					});
				}

				// =========================
				// 7️⃣ UPDATE DATABASE
				// =========================
				const updatedPoint =
					await Point.findOneAndUpdate(
						{ guildId, userId },
						{ $inc: { totalPoints: -jumlahPoin } },
						{ new: true },
					);

				await Currency.findOneAndUpdate(
					{ guildId, userId },
					{ $inc: { totalNC: -totalCost } },
					{ new: true },
				);

				// =========================
				// 8️⃣ HISTORY
				// =========================
				await PointHistory.create({
					guildId,
					userId,
					managerId: userId,
					points: -jumlahPoin,
					type: 'remove',
					reason: `Tebus ${jumlahPoin} penalty dengan NC`,
				});

				await CurrencyHistory.create({
					guildId,
					userId,
					managerId: userId,
					amount: totalCost,
					type: 'spend',
					reason: `Tebus ${jumlahPoin} penalty point`,
				});

				// =========================
				// 9️⃣ LOG KE CHANNEL
				// =========================
				if (settings.channelLog) {
					const logChannel =
						interaction.guild.channels.cache.get(
							settings.channelLog,
						);

					if (logChannel) {
						const logEmbed = new EmbedBuilder()
							.setTitle(
								`📝 ${displayName} menebus penalty`,
							)
							.setColor('Blue')
							.setThumbnail(
								member.displayAvatarURL({
									forceStatic: false,
								}),
							)
							.addFields(
								{
									name: '📋 Poin Ditebus',
									value: `${jumlahPoin} point`,
									inline: true,
								},
								{
									name: '🪙 NC Terpakai',
									value: `${totalCost} N¢`,
									inline: true,
								},
								{
									name: '📊 Sisa Poin Penalty',
									value: `${updatedPoint.totalPoints} point`,
									inline: true,
								},
								{
									name: 'Alasan',
									value: `Tebus penalty menggunakan NC`,
								},
							)
							.setTimestamp();

						logChannel
							.send({ embeds: [logEmbed] })
							.catch(() => {});
					}
				}

				// =========================
				// 🔟 RESPONSE USER
				// =========================
				return i.update({
					content:
						`✅ **Penalty berhasil ditebus!**\n\n` +
						`➖ Penalty ditebus : **${jumlahPoin} point**\n` +
						`➖ NC terpakai     : **${totalCost} N¢**\n` +
						`📊 Sisa penalty   : **${updatedPoint.totalPoints} point**`,
					components: [],
				});
			});

			collector.on('end', async (_, reason) => {
				if (reason === 'time') {
					await interaction.editReply({
						content: '⌛ Waktu konfirmasi habis.',
						components: [],
					});
				}
			});
		} catch (err) {
			console.error('❌ Error bayarpoin:', err);
			return interaction.reply({
				content:
					'⚠️ Terjadi kesalahan saat memproses permintaan.',
				ephemeral: true,
			});
		}
	},
}).toJSON();