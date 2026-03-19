const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Coupon = require('../../models/coupon');
const Currency = require('../../models/currency');
const CurrencyHistory = require('../../models/currencyHistory');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'claim',
		description: 'Claim coupon',
		type: 1,
		options: [
			{
				name: 'code_coupon',
				description: 'Kode Coupon',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const codeCoupon = interaction.options.getString('code_coupon');
			const guildId = interaction.guild.id;
			const userId = interaction.user.id;

			// Cari kupon berdasarkan guildId dan codeCoupon
			const coupon = await Coupon.findOne({ guildId, codeCoupon });
			if (!coupon) {
				return interaction.editReply(
					'❌ Kode kupon tidak ditemukan atau sudah tidak berlaku.',
				);
			}

			// Cek apakah kupon sudah expired
			if (coupon.validUntil && coupon.validUntil < new Date()) {
				return interaction.editReply('❌ Kode kupon sudah expired.');
			}

			// Proses klaim kupon
			const raw =
				Math.floor(
					Math.random() * (coupon.maxAmount - coupon.minAmount + 1),
				) + coupon.minAmount;

			// Bulatkan keribuan
			const ncAmount = Math.round(raw / 1000) * 1000;

            // Cek apakah user sudah pernah klaim kupon ini
			const updated = await Coupon.findOneAndUpdate(
				{
					guildId,
					codeCoupon,
					'driverClaims.driverId': { $ne: userId },
				},
				{
					$push: {
						driverClaims: {
							driverId: userId,
							ncAmount,
							claimedAt: new Date(),
						},
					},
					$inc: {
						totalNcClaimed: ncAmount,
					},
				},
				{ new: true },
			);

			if (!updated) {
				return interaction.editReply(
					'❌ Kamu sudah claim atau kupon tidak valid.',
				);
			}

			// Simpan pendapatan NC ke Currency
			let currency = await Currency.findOne({ guildId, userId: userId });
			if (!currency) {
				currency = await Currency.create({
					guildId,
					userId: userId,
					totalNC: 0,
				});
			}

			currency.totalNC += ncAmount;
			await currency.save();

			// Save history
			await CurrencyHistory.create({
				guildId,
				userId: userId,
				amount: ncAmount,
				managerId: client.user.id,
				reason: `Claim kupon ${coupon.nameCoupon}`,
				type: 'earn',
			});

			const guildSettings = await GuildSettings.findOne({
				guildId: guildId,
			});

			if (!guildSettings) {
				return interaction.editReply(
					'⚠️ Pengaturan guild tidak ditemukan. Pastikan bot sudah diatur dengan benar.',
				);
			}

			// Log channel
			if (guildSettings.channelLog) {
				const logCh = interaction.guild.channels.cache.get(
					guildSettings.channelLog,
				);
				if (logCh) {
					logCh.send({
						embeds: [
							new EmbedBuilder()
								.setTitle(`🟢 Coupon Claimed`)
								.addFields(
									{
										name: 'Coupon',
										value: coupon.nameCoupon,
										inline: true,
									},
									{
										name: 'Driver',
										value: `<@${userId}>`,
										inline: true,
									},
									{
										name: 'Amount',
										value: `${ncAmount} NC`,
										inline: true,
									},
									{
										name: 'Reason',
										value: `Claim kupon ${coupon.nameCoupon}`,
									},
								)
								.setColor('Green'),
						],
					});
				}
			}

			return interaction.editReply({
				content:
					`✅ Kode Kupon berhasil diklaim! Kamu mendapatkan **${ncAmount} N¢**\n` +
					`💳 Total NC sekarang: **${currency.totalNC} N¢**`,
				ephemeral: true,
			});
		} catch (err) {
			console.error('❌ Gagal claim coupon:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat menyimpan data ke database.',
			);
		}
	},
}).toJSON();
