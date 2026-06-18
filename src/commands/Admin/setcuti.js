const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const LeaveHistory = require('../../models/leaveHistory');
const Users = require('../../models/Users');
const GuildSettings = require('../../models/guildsetting');
const DriverData = require('../../models/driverlink');

module.exports = new ApplicationCommand({
	command: {
		name: 'setcuti',
		description: 'Set cuti untuk driver',
		type: 1,
		options: [
			{
				name: 'driver',
				description: 'Pilih driver yang akan diberikan cuti',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
			{
				name: 'durasi',
				description:
					'Jumlah hari cuti yang akan ditambahkan, semisal 1 hari = 1',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				name: 'alasan',
				description: 'Alasan cuti driver',
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
			const hari = interaction.options.getInteger('hari');
			const alasan = interaction.options.getString('alasan');

			const endDate = new Date(Date.now() + hari * 24 * 60 * 60 * 1000);

			const managerName = interaction.user.username;
			const driverName = driver.username;

			const settings = await GuildSettings.findOne({ guildId });
			if (!settings) {
				return interaction.editReply(
					'⚠️ Guild belum memiliki konfigurasi settings.',
				);
			}

			const managerRoles = settings.roles?.manager || [];
			if (!managerRoles.length) return;

			const roleMentions = managerRoles
				.map((id) => `<@&${id}>`)
				.join(' ');

			// ❌ Tidak boleh ke bot
			if (driver.bot) {
				return interaction.editReply(
					'❌ Kamu tidak bisa memberikan cuti kepada bot.',
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
					'❌ User ini **bukan driver atau magang** sehingga tidak dapat diberikan cuti.',
				);
			}

			const driverData = await DriverData.findOne({
				userId: driver.id,
				guildId,
			});

			if (!driverData) {
				return interaction.editReply(
					'❌ Data driver tidak ditemukan. Pastikan driver sudah terdaftar di sistem.',
				);
			}

			const truckyId = driverData.truckyId;

			await LeaveHistory.create({
				userId: driver.id,
				managerId: managerId,
				managerName: managerName,
				truckyId: truckyId,
				startDate: new Date(),
				endDate: endDate,
				reason: alasan,
				status: 'active',
			});

			await Users.updateOne(
				{ discordId: driver.id },
				{ isOnLeave: true },
			);

			// 🎯 Embed respon
			const embed = new EmbedBuilder()
				.setTitle('🧾 Cuti Diberikan!')
				.setColor('Yellow')
				.addFields(
					{
						name: 'Driver',
						value: `<@${driver.id}> (${driverData.truckyName})`,
						inline: true,
					},
					{
						name: 'Jumlah Hari',
						value: `${hari} hari`,
						inline: true,
					},
					{
						name: 'Periode Cuti',
						value: `${new Date().toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`,
						inline: true,
					},
					{ name: 'Alasan', value: alasan },
				)
				.setFooter({
					text: `Diberikan oleh ${interaction.user.username}`,
				})
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });

			// 🧾 Logging ke channel log
			if (settings.channelLog) {
				const logChannel = interaction.guild.channels.cache.get(
					settings.channelLog,
				);

				if (logChannel) {
					const logEmbed = new EmbedBuilder()
						.setTitle(
							`📝 ${driverData.truckyName} Telah Mendapatkan Cuti`,
						)
						.setColor('Blue')
						.addFields(
							{
								name: 'Manager Penerima',
								value: `<@${managerId}> (${managerName})`,
								inline: true,
							},
							{
								name: 'Driver',
								value: `<@${driver.id}> (${driverData.truckyName})`,
								inline: true,
							},
							{
								name: 'Periode Cuti',
								value: `${new Date().toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`,
							},
							{ name: 'Alasan Cuti', value: alasan },
						)
						.setTimestamp();

					logChannel
						.send({
							content: `${roleMentions}`,
							embeds: [logEmbed],
						})
						.catch(() => {});
				}
			}

			// 📩 DM ke driver
			const dmEmbed = new EmbedBuilder()
				.setTitle('🔔 Izin Cuti Kamu Telah Diberikan!')
				.setColor('Blue')
				.setDescription(
					`Izin cuti kamu dari tanggal ${new Date().toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')} telah disetujui. Izin diberikan oleh ${interaction.user.username}. \n\nSelama masa cuti, pastikan untuk beristirahat dengan baik dan kembali dengan semangat baru! Apabila kamu memiliki pertanyaan atau membutuhkan bantuan, jangan ragu untuk menghubungi tim HR Nismara Transport.`,
				)
				.addFields({
					name: '📊 Detail Cuti',
					value:
						`• **Periode Cuti**: ${new Date().toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}\n` +
						`• **Durasi**: ${hari} hari\n` +
						`• **Alasan**: ${alasan}`,
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
			console.error('❌ Error Set Cuti:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat memproses perintah.',
			);
		}
	},
}).toJSON();
