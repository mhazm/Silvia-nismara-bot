const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot.js');
const ApplicationCommand = require('../../structure/ApplicationCommand.js');
const Achievement = require('../../models/achievement.js');

module.exports = new ApplicationCommand({
	command: {
		name: 'addachievement',
		description: 'Tambahkan data master achievement baru ke database',
		type: 1, // 1 = Chat Input (Slash Command)
		options: [
			{
				name: 'code_id',
				description: 'Kode unik (Tanpa spasi, contoh: HW_RUNNER)',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: 'name',
				description:
					'Nama persis dari webhook Trucky (Contoh: Highway Runner)',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: 'category',
				description: 'Kategori tipe achievement',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{ name: 'Mingguan (Weekly)', value: 'weekly' },
					{ name: 'Bulanan (Monthly)', value: 'monthly' },
					{ name: 'Spesial Event (Event)', value: 'event' },
					{ name: 'Satu Kali Saja (One-Time)', value: 'onetime' },
				],
			},
			{
				name: 'description',
				description: 'Deskripsi untuk achievement ini',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
			{
				name: 'image_url',
				description: 'Link URL untuk gambar/icon achievement',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
		],
	},
	options: {
		allowedRoles: ['manager'],
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		try {
			await interaction.deferReply({ ephemeral: false });

			// Ambil semua input dari user
			const codeId = interaction.options
				.getString('code_id')
				.toUpperCase()
				.trim();
			const name = interaction.options.getString('name').trim();
			const category = interaction.options.getString('category');
			const description =
				interaction.options.getString('description') ||
				'Belum ada deskripsi.';
			const imageUrl = interaction.options.getString('image_url') || null;

			// 3. Validasi Data Kembar (Duplicate Check)
			const existingAchievement = await Achievement.findOne({
				$or: [{ codeId: codeId }, { name: name }],
			});

			if (existingAchievement) {
				return interaction.editReply({
					content: `⚠️ **Gagal!** Achievement dengan nama \`${name}\` atau kode \`${codeId}\` sudah terdaftar di database.`,
				});
			}

			// 4. Input ke Database
			const newAchievement = await Achievement.create({
				codeId,
				name,
				category,
				description,
				imageUrl,
			});

			// 5. Buat Embed Konfirmasi Sukses
			const successEmbed = new EmbedBuilder()
				.setTitle('✅ Master Achievement Berhasil Ditambahkan')
				.setColor('Green')
				.addFields(
					{
						name: '📌 Nama Achievement',
						value: `\`${newAchievement.name}\``,
						inline: true,
					},
					{
						name: '🔑 Kode Unik',
						value: `\`${newAchievement.codeId}\``,
						inline: true,
					},
					{
						name: '🏷️ Kategori',
						value: `${newAchievement.category.toUpperCase()}`,
						inline: true,
					},
					{
						name: '📝 Deskripsi',
						value: `${newAchievement.description}`,
					},
				)
				.setTimestamp();

			// Jika user menyertakan URL gambar, tampilkan di embed (Cek apakah linknya valid secara kasar)
			if (imageUrl && imageUrl.startsWith('http')) {
				successEmbed.setThumbnail(imageUrl);
			}

			// 6. Kirim Respon
			return interaction.editReply({
				embeds: [successEmbed],
			});
		} catch (error) {
			console.error('❌ Error pada command /addachievement:', error);

			// Cek apakah interaksi sudah di-defer atau belum
			if (interaction.deferred) {
				return interaction.editReply({
					content:
						'⚠️ Terjadi kesalahan sistem saat menyimpan ke database.',
				});
			} else {
				return interaction.reply({
					content: '⚠️ Terjadi kesalahan sistem.',
					ephemeral: true,
				});
			}
		}
	},
}).toJSON();
