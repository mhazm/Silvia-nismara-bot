const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const ApplicationCommand = require('../../structure/ApplicationCommand');
const DriverLink = require('../../models/driverlink');
const Currency = require('../../models/currency');
const Point = require('../../models/points');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'mergeakun',
		description: 'Pindahkan data driver ke akun Discord baru (berdasarkan Trucky ID)',
		options: [
			{
				name: 'truckyid',
				description: 'Trucky ID driver',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				name: 'discord_baru',
				description: 'Akun Discord baru',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},

	run: async (client, interaction) => {
		if (!(interaction instanceof ChatInputCommandInteraction)) return;

		const guildId = interaction.guild.id;
		const adminId = interaction.user.id;

		const truckyId = interaction.options.getInteger('truckyid');
		const newUser = interaction.options.getUser('discord_baru');
		const newUserId = newUser.id;

		// =========================
		// AMBIL GUILD SETTINGS
		// =========================
		const settings = await GuildSettings.findOne({ guildId });

		if (!settings) {
			return interaction.reply({
				content: '❌ Guild settings belum dikonfigurasi.',
				ephemeral: true,
			});
		}

		// =========================
		// VALIDASI ROLE MANAGER
		// =========================
		const managerRoles = settings.roles?.manager || [];

		if (!managerRoles.length) {
			return interaction.reply({
				content: '❌ Role manager belum diset di GuildSettings.',
				ephemeral: true,
			});
		}

		const member = await interaction.guild.members.fetch(adminId);
		const isManager = managerRoles.some((roleId) =>
			member.roles.cache.has(roleId),
		);

		if (!isManager) {
			return interaction.reply({
				content: '❌ Kamu tidak memiliki izin menggunakan command ini.',
				ephemeral: true,
			});
		}

		// =========================
		// CARI DRIVER (TRUCKY ID)
		// =========================
		const driver = await DriverLink.findOne({ guildId, truckyId });

		if (!driver) {
			return interaction.reply({
				content: `❌ Driver dengan Trucky ID **${truckyId}** tidak ditemukan.`,
				ephemeral: true,
			});
		}

		const oldUserId = driver.userId;

		// =========================
		// CEK KONFLIK
		// =========================
		if (oldUserId === newUserId) {
			return interaction.reply({
				content: '⚠️ Akun Discord baru sama dengan akun lama.',
				ephemeral: true,
			});
		}

		const conflict = await DriverLink.findOne({
			guildId,
			userId: newUserId,
		});

		if (conflict) {
			return interaction.reply({
				content:
					'❌ Akun Discord baru sudah terdaftar sebagai driver lain.',
				ephemeral: true,
			});
		}

		// =========================
		// MERGE DATABASE
		// =========================
		await Promise.all([
			DriverLink.updateOne(
				{ _id: driver._id },
				{
					userId: newUserId,
					$addToSet: { previousUserIds: oldUserId },
				},
			),
			Currency.updateOne(
				{ guildId, userId: oldUserId },
				{ userId: newUserId },
			),
			Point.updateOne(
				{ guildId, userId: oldUserId },
				{ userId: newUserId },
			),
		]);

		// =========================
		// PASANG ROLE DRIVER
		// =========================
		const newMember = await interaction.guild.members
			.fetch(newUserId)
			.catch(() => null);

		if (newMember) {
			const driverRoles = settings.roles?.driver || [];
			if (driverRoles.length) {
				await newMember.roles.add(driverRoles);
			}
		}

		// =========================
		// LOG KE CHANNEL LOG
		// =========================
		if (settings.channelLog) {
			const logChannel =
				interaction.guild.channels.cache.get(settings.channelLog);

			if (logChannel) {
				const logEmbed = new EmbedBuilder()
					.setTitle('🔄 Merge Akun Driver')
					.setColor('Orange')
					.addFields(
						{ name: '🚛 Trucky ID', value: String(truckyId), inline: true },
						{
							name: '👤 Discord Lama',
							value: `<@${oldUserId}>`,
							inline: true,
						},
						{
							name: '👤 Discord Baru',
							value: `<@${newUserId}>`,
							inline: true,
						},
						{
							name: '🛂 Admin',
							value: `<@${adminId}>`,
							inline: true,
						},
					)
					.setTimestamp();

				await logChannel.send({ embeds: [logEmbed] });
			}
		}

		// =========================
		// RESPONSE KE ADMIN
		// =========================
		return interaction.reply({
			content: `✅ **Merge akun berhasil!**\nDriver Trucky ID **${truckyId}** sekarang terhubung ke <@${newUserId}>.`,
			ephemeral: true,
		});
	},
}).toJSON();