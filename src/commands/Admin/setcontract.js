const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Contract = require('../../models/contract');
const ContractHistory = require('../../models/ContractHistorys');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'setcontract',
		description: 'Set perussahaan kontrak aktif',
		type: 1,
		options: [
			{
				name: 'name',
				description:
					'Nama Perusahaan Kontrak (Harus sama dengan source_company_name di Trucky)',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: 'game',
				description: 'Pilih game untuk kontrak ini. 1 = ETS2, 2 = ATS',
				choices: [
					{ name: 'Euro Truck Simulator 2', value: 1 },
					{ name: 'American Truck Simulator', value: 2 },
				],
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
			const companyName = interaction.options.getString('name');
			const companyImage = interaction.options.getString('image');
			const gameId = interaction.options.getInteger('game');
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

			const endDate = new Date(
				Date.now() + durationDays * 24 * 60 * 60 * 1000,
			);

			// 🔹 Tutup kontrak lama di history (jika masih aktif)
			const lastHistory = await ContractHistory.findOne({
				guildId,
				gameId: gameId,
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

			// 🔹 Simpan kontrak baru ke history
			await ContractHistory.create({
				guildId: guildId,
				gameId: gameId,
				companyName: companyName,
				imageUrl: companyImage,
				setBy: userId,
				startDate: new Date(),
			});

			// 🔹 Simpan / update kontrak aktif per guild
			const existing = await Contract.findOne({
				guildId: guildId,
				gameId: gameId,
			});
			if (existing) {
				existing.companyName = companyName;
				existing.gameId = gameId;
				existing.imageUrl = companyImage;
				existing.setBy = userId;
				existing.createdAt = new Date();
				await existing.save();
			} else {
				await Contract.create({
					guildId: guildId,
					gameId: gameId,
					companyName: companyName,
					imageUrl: companyImage,
					setBy: userId,
					endAt: endDate,
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
				.setColor('#00AEEF')
				.setTitle(`📦 Special Contract Ditetapkan untuk ${mapGame(gameId)}`)
				.addFields(
					{
						name: '🏢 Nama Perusahaan',
						value: companyName,
						inline: true,
					},
					{
						name: '👤 Diset oleh',
						value: `<@${userId}>`,
						inline: true,
					},
					{
						name: '🕒 Tanggal Mulai',
						value: `<t:${Math.floor(Date.now() / 1000)}:f>`,
					},
					{
						name: '📅 Tanggal Berakhir',
						value: `<t:${Math.floor(endDate.getTime() / 1000)}:f>`,
					},
					{
						name: '⏳ Durasi',
						value: `${durationDays} hari`,
						inline: true,
					},
				)
				.setFooter({
					text: 'Gunakan /contractstatus untuk melihat status saat ini',
				})
				.setTimestamp();

			if (companyImage) embed.setImage(companyImage);

			await notifyChannel?.send({ embeds: [embed] });

			return interaction.editReply({
				content:
					'✅ Special Contract berhasil diset & dicatat dalam riwayat!',
				embeds: [embed],
			});
		} catch (err) {
			console.error('❌ Gagal menyimpan contract:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat menyimpan data ke database.',
			);
		}
	},
}).toJSON();

function mapGame(game) {
	if (game === 1 || game === '1') return 'Euro Truck Simulator 2';
	if (game === 2 || game === '2') return 'American Truck Simulator';
	return 'Unknown';
}