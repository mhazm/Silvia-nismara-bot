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
const Currency = require('../../models/currency.js');
const Users = require('../../models/Users.js');
const JobHistories = require('../../models/jobHistory.js');
const DriverLink = require('../../models/driverlink.js');
const { updateDriverWidget } = require('../../utils/widgetUpdater.js');

module.exports = new ApplicationCommand({
	command: {
		name: 'updatewidget',
		description: 'Test command untuk update widget',
		type: 1,
		options: [],
	},
	options: {},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		try {
			await interaction.deferReply({ ephemeral: true });

			try {
				const discordId = interaction.user.id;
				const guildId = '863959415702028318';

				// 1. Ambil data driver utama dari koleksi Users
				const driverData = await Users.findOne({
					discordId: discordId,
				});

				if (!driverData) {
					return interaction.editReply({
						content:
							'❌ Kamu belum terdaftar di database Nismara Transport.',
					});
				}

				// 2. Ambil statistik job dari koleksi JobHistories menggunakan Aggregation
				const stats = await JobHistories.aggregate([
					{ $match: { driverId: discordId, guildId: guildId } },
					{
						$group: {
							_id: null,
							totalJobs: { $sum: 1 },
							totalCompletedJobs: {
								$sum: {
									$cond: [
										{ $eq: ['$jobStatus', 'COMPLETED'] },
										1,
										0,
									],
								},
							},
							totalCanceledJobs: {
								$sum: {
									$cond: [
										{ $eq: ['$jobStatus', 'CANCELED'] },
										1,
										0,
									],
								},
							},
							totalDistance: {
								$sum: {
									$cond: [
										{ $eq: ['$jobStatus', 'COMPLETED'] },
										'$distanceKm',
										0,
									],
								},
							},
						},
					},
				]);

				// Jika punya riwayat, ambil index ke-0. Jika tidak, jadikan 0 semua.
				const jobStats =
					stats.length > 0
						? stats[0]
						: {
								totalJobs: 0,
								totalCompletedJobs: 0,
								totalCanceledJobs: 0,
								totalDistance: 0,
							};

				const currency = await Currency.findOne({
					userId: discordId,
					guildId: guildId,
				});
				if (!currency) {
					return interaction.editReply({
						content:
							'❌ Kamu belum terdaftar di database Nismara Transport.',
					});
				}

				const driverLink = await DriverLink.findOne({
					userId: discordId,
					guildId: guildId,
				});

				if (!driverLink) {
					return interaction.editReply({
						content:
							'❌ Kamu belum terdaftar di database Nismara Transport.',
					});
				}

				const userJoinedDate = driverLink.createdAt
					? new Date(driverLink.createdAt)
					: new Date();
				const formattedDate = userJoinedDate.toLocaleDateString(
					'id-ID',
					{
						day: 'numeric',
						month: 'long',
						year: 'numeric',
					},
				);

				const points = await Point.findOne({
					userId: discordId,
					guildId: guildId,
				});
				if (!points) {
					return interaction.editReply({
						content:
							'❌ Kamu belum terdaftar di database Nismara Transport.',
					});
				}

				// 3. Gabungkan data
				const combinedData = {
					roleName: driverData.roleName || 'Driver',
					level: driverData.level || 1,
					totalDistance: jobStats.totalDistance,
					totalJobs: jobStats.totalJobs,
					totalCompletedJobs: jobStats.totalCompletedJobs,
					totalCanceledJobs: jobStats.totalCanceledJobs,
					walletBalance: currency.totalNC || 0,
					widgetImage:
						driverData.widgetImage ||
						'https://images.nismara.my.id/Nismara_widget_default.png',
					driverName:
						driverData.name || driverLink.truckyName || 'Driver',
					userJoinedDate: formattedDate,
					totalPenalty: points.totalPoints || 0,
					name: driverData.name || driverLink.truckyName || 'Driver',
				};

				// 4. Eksekusi fungsi update widget
				// (Pastikan fungsi updateDriverWidget me-return boolean true/false berdasarkan sukses tidaknya fetch API)
				const isSuccess = await updateDriverWidget(
					client,
					discordId,
					combinedData,
				);

				if (isSuccess) {
					return interaction.editReply({
						content:
							'✅ **Berhasil!** Widget profil Discord kamu sudah di-update dengan data logbook terbaru. Coba klik profilmu untuk melihatnya!',
					});
				} else {
					return interaction.editReply({
						content:
							'❌ **Gagal update widget.**\nPastikan kamu sudah Login menggunakan Discord di website web Nismara Transport agar bot memiliki izin untuk mengubah widget profilmu.',
					});
				}
			} catch (error) {
				console.error(
					`[COMMAND ERROR] /updatewidget oleh ${interaction.user.tag}:`,
					error,
				);
				return interaction.editReply({
					content:
						'❌ Terjadi kesalahan pada sistem saat mencoba kalkulasi data database.',
				});
			}
		} catch (err) {
			console.error('❌ Error update widget:', err);
			return interaction.reply({
				content: '⚠️ Terjadi kesalahan saat memproses permintaan.',
				ephemeral: true,
			});
		}
	},
}).toJSON();
