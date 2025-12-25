const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'addpoint',
		description: 'Tambahkan poin ke pengguna',
		type: 1,
		options: [
			{
				name: 'driver',
				description: 'Pilih driver yang akan ditambahkan poin',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
			{
				name: 'jumlah',
				description: 'Jumlah poin yang akan ditambahkan',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				name: 'alasan',
				description: 'Alasan penambahan poin',
				type: ApplicationCommandOptionType.String,
				required: true,
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
		await interaction.deferReply({ ephemeral: true });

		try {
			const guildId = interaction.guild.id;
			const managerId = interaction.user.id;
			const driver = interaction.options.getUser('driver');
			const jumlah = interaction.options.getInteger('jumlah');
			const alasan = interaction.options.getString('alasan');

			const settings = await GuildSettings.findOne({ guildId });
			if (!settings) {
				return interaction.editReply(
					'⚠️ Guild belum memiliki konfigurasi settings.',
				);
			}

			// ❌ Tidak boleh ke bot
			if (driver.bot) {
				return interaction.editReply(
					'❌ Kamu tidak bisa memberikan poin ke bot.',
				);
			}

			// 🔑 Gabungkan role Sopir + Magang
			const driverRoles = [
				...(settings.roles?.driver || []),
				...(settings.roles?.magang || []),
			];

			if (!driverRoles.length) {
				return interaction.editReply(
					'⚠️ Role driver / magang belum diset di guild settings.',
				);
			}

			const member = await interaction.guild.members.fetch(driver.id);

			// ✅ Validasi: punya salah satu role
			const isDriver = member.roles.cache.some((r) =>
				driverRoles.includes(r.id),
			);

			if (!isDriver) {
				return interaction.editReply(
					'❌ User ini **bukan driver atau magang** sehingga tidak dapat diberi poin.',
				);
			}

			// Ambil atau buat data poin
			let pointData = await Point.findOne({
				guildId,
				userId: driver.id,
			});

			if (!pointData) {
				pointData = await Point.create({
					guildId,
					userId: driver.id,
					totalPoints: 0,
				});
			}

			// ➕ Tambah poin
			pointData.totalPoints += jumlah;
			await pointData.save();

			// 📝 Simpan history
			await PointHistory.create({
				guildId,
				userId: driver.id,
				managerId,
				points: jumlah,
				reason: alasan,
				type: 'add',
			});

			// 🎯 Embed respon
			const embed = new EmbedBuilder()
				.setTitle('🎯 Poin Ditambahkan!')
				.setColor('Red')
				.addFields(
					{ name: 'Driver', value: `<@${driver.id}>`, inline: true },
					{ name: 'Jumlah Poin', value: `${jumlah}`, inline: true },
					{ name: 'Alasan', value: alasan },
				)
				.setFooter({
					text: `Diberikan oleh ${interaction.user.username}`,
				})
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });

			// 🧾 Logging ke channel log
			if (settings.channelLog) {
				const logChannel =
					interaction.guild.channels.cache.get(
						settings.channelLog,
					);

				if (logChannel) {
					const logEmbed = new EmbedBuilder()
						.setTitle('📝 Add Point Log')
						.setColor('Blue')
						.addFields(
							{
								name: 'Manager',
								value: `<@${managerId}>`,
								inline: true,
							},
							{
								name: 'Driver',
								value: `<@${driver.id}>`,
								inline: true,
							},
							{
								name: 'Poin',
								value: `+${jumlah}`,
								inline: true,
							},
							{ name: 'Alasan', value: alasan },
						)
						.setTimestamp();

					logChannel.send({ embeds: [logEmbed] }).catch(() => {});
				}
			}

			// 📩 DM ke driver
			const dmEmbed = new EmbedBuilder()
				.setTitle('⚠️ Kamu Telah Mendapatkan Poin!')
				.setColor('Red')
				.setDescription(
					`Kamu baru saja menerima **+${jumlah} poin** dari ${interaction.user.username} di server **${interaction.guild.name}**.`,
				)
				.addFields(
					{ name: '📝 Alasan', value: alasan },
					{
						name: '📊 Total Poin Sekarang',
						value: `${pointData.totalPoints}`,
					},
				)
				.setFooter({
					text: 'Perbaiki performamu agar tidak terjadi lagi ya.',
				})
				.setTimestamp();

			try {
				await driver.send({ embeds: [dmEmbed] });
			} catch {
				console.warn(
					`Tidak bisa kirim DM ke ${driver.tag} (DM tertutup).`,
				);
			}
		} catch (err) {
			console.error('❌ Error addpoint:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat memproses perintah.',
			);
		}
	},
}).toJSON();