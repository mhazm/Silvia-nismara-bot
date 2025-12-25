const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const GuildSettings = require('../../models/guildsetting');
const DriverLink = require('../../models/driverlink');
const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');

module.exports = new ApplicationCommand({
	command: {
		name: 'assigndriver',
		description: 'Mengangkat user magang menjadi driver',
		options: [
			{
				name: 'user',
				description: 'User yang akan diangkat menjadi driver',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	options: {
		allowedRoles: ['manager'],
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const guild = interaction.guild;
			const guildId = guild.id;
			const executor = interaction.user;
			const targetUser = interaction.options.getUser('user');
			const member = await guild.members.fetch(targetUser.id);

			// =========================
			// GUILD SETTINGS
			// =========================
			const settings = await GuildSettings.findOne({ guildId });
			if (!settings)
				return interaction.editReply('❌ Guild settings belum diset.');

			const magangRoles = settings.roles?.magang || [];
			const driverRoles = settings.roles?.driver || [];

			if (!magangRoles.length || !driverRoles.length)
				return interaction.editReply(
					'❌ Role magang / driver belum dikonfigurasi.',
				);

			const hasMagang = member.roles.cache.some((r) =>
				magangRoles.includes(r.id),
			);
			const hasDriver = member.roles.cache.some((r) =>
				driverRoles.includes(r.id),
			);

			if (hasDriver)
				return interaction.editReply(
					'⚠️ User ini sudah memiliki role driver.',
				);

			if (!hasMagang)
				return interaction.editReply(
					'❌ User ini tidak memiliki role magang.',
				);

			// =========================
			// DRIVER LINK
			// =========================
			const driverLink = await DriverLink.findOne({
				guildId,
				userId: targetUser.id,
			});

			if (!driverLink)
				return interaction.editReply(
					'❌ Driver ini belum terdaftar di database Trucky.',
				);

			// =========================
			// ROLE UPDATE
			// =========================
			await member.roles.remove(magangRoles);
			await member.roles.add(driverRoles);

			// =========================
			// POINT RESET (JIKA ADA)
			// =========================
			const point = await Point.findOne({
				guildId,
				userId: targetUser.id,
			});

			let removedPoints = null;

			if (point && point.totalPoints > 0) {
				removedPoints = point.totalPoints;

				point.totalPoints = 0;
				await point.save();

				await PointHistory.create({
					guildId,
					userId: targetUser.id,
					managerId: executor.id,
					points: removedPoints,
					type: 'remove',
					reason: 'Reset point saat pengangkatan dari magang ke driver',
				});
			}

			// =========================
			// DM KE USER
			// =========================
			const dmEmbed = new EmbedBuilder()
				.setColor('Green')
				.setTitle('🚛 Selamat! Kamu Resmi Menjadi Driver')
				.setDescription(
					`Hai **${targetUser.username}**,  
kamu telah resmi diangkat menjadi **Driver**.\n\n` +
						(removedPoints !== null
							? `🧾 Point kamu telah direset menjadi **0** (sebelumnya ${removedPoints} points).\n\nTolong diperbaiki lagi kinerja kamu kedepannya ya, jangan sampai dapat poin lagi.\nApabila ada pertanyaan seputar regulasi, kamu bisa langsung kontrak manajemen Nismara Group.\n\nJangan malu-malu untuk gabung ke voice kita ya`
							: `🧾 Kamu tidak memiliki point penalty sebelumnya.\n\n Pertahankan kinerja baik kamu selama masa magang ini ya!\nApabila kamu ada pertanyaan, kamu bisa langsung kontrak manajemen Nismara Group.\n\nJangan malu-malu untuk gabung ke voice kita ya`),
				)
				.setTimestamp();

			targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

			// =========================
			// LOG CHANNEL
			// =========================
			if (settings.channelLog) {
				const logChannel = guild.channels.cache.get(
					settings.channelLog,
				);

				if (logChannel) {
					const logEmbed = new EmbedBuilder()
						.setColor('Blue')
						.setTitle('✅ Assign Driver')
						.addFields(
							{
								name: '👤 Driver',
								value: `<@${targetUser.id}>`,
								inline: true,
							},
							{
								name: '🚛 Trucky Name',
								value: driverLink.truckyName,
								inline: true,
							},
							{
								name: '🧑‍💼 Executor',
								value: `<@${executor.id}>`,
								inline: true,
							},
							{
								name: '🧾 Reset Point',
								value:
									removedPoints !== null
										? `${removedPoints} points`
										: 'Tidak ada point',
							},
						)
						.setTimestamp();

					logChannel.send({ embeds: [logEmbed] });
				}
			}

			// =========================
			// RESPONSE
			// =========================
			await interaction.editReply(
				`✅ **${targetUser.username}** berhasil diangkat menjadi driver.`,
			);
		} catch (err) {
			console.error(err);
			await interaction.editReply('❌ Terjadi error.');
		}
	},
}).toJSON();
