const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Coupon = require('../../models/coupon');
const CouponHistory = require('../../models/couponHistory');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'setcoupon',
		description: 'Set coupon baru',
		type: 1,
		options: [
			{
				name: 'name',
				description: 'Nama Coupon',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: 'code_coupon',
				description: 'Kode Coupon (Harus unik)',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: 'min_amount',
				description: 'Jumlah minimum pendapatan NC',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				name: 'max_amount',
				description: 'Jumlah maksimum pendapatan NC',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				name: 'durasi',
				description: 'Durasi kontrak dalam hari',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				name: 'image',
				description: 'URL Gambar Perusahaan Kontrak',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
		],
	},
	options: {
		allowedRoles: ['manager'], // Hanya user dengan role ini yang bisa menjalankan command
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const codeName = interaction.options.getString('name');
			const codeCoupon = interaction.options.getString('code_coupon');
			const companyImage = interaction.options.getString('image');
			const minAmount = interaction.options.getInteger('min_amount');
			const maxAmount = interaction.options.getInteger('max_amount');
			const durationDays = interaction.options.getInteger('durasi');
			const guildId = interaction.guild.id;
			const userId = interaction.user.id;

			// 🔹 Validasi URL gambar (jika ada)
			if (
				companyImage &&
				!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(companyImage)
			) {
				return interaction.editReply(
					'⚠️ URL gambar tidak valid. Harus berupa tautan langsung ke file gambar (jpg/png/gif/webp).',
				);
			}

			// Validasi Jumlah minimum dan maksimum NC
			if (minAmount < 0 || maxAmount < 0) {
				return interaction.editReply(
					'⚠️ Jumlah minimum dan maksimum NC harus berupa angka positif.',
				);
			}

			if (minAmount > maxAmount) {
				return interaction.editReply(
					'⚠️ Minimum tidak boleh lebih besar dari maksimum.',
				);
			}

			const endDate = new Date(
				Date.now() + durationDays * 24 * 60 * 60 * 1000,
			);

			// 🔹 Tutup kontrak lama di history (jika masih aktif)
			const lastHistory = await CouponHistory.findOne({
				guildId,
				codeCoupon: codeCoupon,
			}) // cari kontrak terakhir di guild ini
				.sort({ startDate: -1 }); // urutkan dari yang terbaru

			if (lastHistory && !lastHistory.endDate) {
				lastHistory.endDate = new Date();
				lastHistory.durationDays = Math.ceil(
					(lastHistory.endDate - lastHistory.startDate) /
						(1000 * 60 * 60 * 24),
				);
				await lastHistory.save();
			}

			// 🔹 Simpan / update kontrak aktif per guild
			const existing = await Coupon.findOne({
				guildId: guildId,
				codeCoupon: codeCoupon,
			});
			if (existing) {
				existing.nameCoupon = codeName;
				existing.codeCoupon = codeCoupon;
				existing.minAmount = minAmount;
				existing.maxAmount = maxAmount;
				existing.imageUrl = companyImage;
				existing.setBy = userId;
				existing.setAt = new Date();
				((existing.validUntil = endDate), await existing.save());
			} else {
				await Coupon.create({
					guildId: guildId,
					codeCoupon: codeCoupon,
					nameCoupon: codeName,
					minAmount: minAmount,
					maxAmount: maxAmount,
					imageUrl: companyImage,
					setBy: userId,
					setAt: new Date(),
					validUntil: endDate,
				});
			}

			const settings = await GuildSettings.findOne({
				guildId: guildId,
			});

			if (!settings) {
				return interaction.editReply(
					'⚠️ Pengaturan guild tidak ditemukan. Pastikan bot sudah diatur dengan benar.',
				);
			}

			const notifyChannel = interaction.guild.channels.cache.get(
				settings.eventNotifyChannel,
			);

			// 🔹 Kirim embed konfirmasi
			const embed = new EmbedBuilder()
				.setColor('#2d0de4')
				.setTitle(`📦 Kode Kupon **${codeName}** Telah Dibuat!`)
				.addFields(
					{
						name: '🏢 Kode Kupon',
						value: `||${codeCoupon}||`,
					},
					{
						name: '💰 Minimum NC',
						value: minAmount.toString(),
						inline: true,
					},
					{
						name: '💰 Maksimum NC',
						value: maxAmount.toString(),
						inline: true,
					},
					{
						name: '🕒 Tanggal Mulai',
						value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
					},
					{
						name: '📅 Tanggal Berakhir',
						value: `<t:${Math.floor(endDate.getTime() / 1000)}:F>`,
					},
					{
						name: '⏳ Durasi',
						value: `${durationDays} hari`,
						inline: true,
					},
					{
						name: '👤 Dibuat oleh',
						value: `<@${userId}>`,
						inline: true,
					},
				)
				.setFooter({
					text: 'Ketik /claim <kode_kupon> untuk mengklaim kupon ini!',
				})
				.setTimestamp();

			if (companyImage) embed.setImage(companyImage);

			await notifyChannel?.send({ embeds: [embed] });

			return interaction.editReply({
				content:
					'✅ Kode Kupon berhasil dibuat & dicatat dalam riwayat!',
				embeds: [embed],
			});
		} catch (err) {
			console.error('❌ Gagal menyimpan coupon:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat menyimpan data ke database.',
			);
		}
	},
}).toJSON();
