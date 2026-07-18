const {
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	AttachmentBuilder,
} = require('discord.js');
const Event = require('../../structure/Event');
const DriverRegistry = require('../../models/driverlink');
const GuildSettings = require('../../models/guildsetting');
const JobHistory = require('../../models/jobHistory');
const Contract = require('../../models/contract');
const {
	applyCancelPenalty,
} = require('../../services/cancelJobPenalty.service');
const { notifyPointResult } = require('../../services/cancelJobNotify.service');
const { buildDeliveryOrder } = require('../../utils/generateDeliveryOrder');

const PENALTY_POINTS = 5;

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			if (!message.guild) return;

			const settings = await GuildSettings.findOne({
				guildId: message.guild.id,
			});
			if (!settings || !settings.truckyWebhookChannel) return;
			if (message.channel.id !== settings.truckyWebhookChannel) return;

			// Izinkan jika pesan dari webhook ATAU dari bot itu sendiri
			if (!message.webhookId && message.author.id !== __client__.user.id)
				return;
			if (!message.embeds?.length) return;

			const embed = message.embeds[0];
			if (!embed.title || !embed.title.includes('Job Started')) return;

			const match = embed.title.match(/#(\d+)/);
			if (!match) return;

			const jobId = match[1];
			const guildId = message.guild.id;

			console.log(`🔍 Detect Guild ID: ${guildId}`);
			console.log(`🚛 Detected job started: ${jobId}`);

			const res = await fetch(
				`https://e.truckyapp.com/api/v1/job/${jobId}`,
				{
					headers: {
						'x-access-token': process.env.TRUCKY_API_KEY,
						Accept: 'application/json',
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
						Referer: 'https://nismara.web.id/',
						Origin: 'https://nismara.web.id',
					},
				},
			);

			if (!res.ok) {
				console.log('❌ API request failed with status:', res.status);
				return;
			}

			const job = await res.json();

			const truckyName = job.driver?.name;
			if (!truckyName) return;

			const truckyId = job.driver?.id;
			if (!truckyId) return;

			const gameId = job.game_id || 'unknown';

			// Cek special contract channel
			const notifyChannel = message.guild.channels.cache.get(
				settings.contractChannel,
			);
			if (!notifyChannel) {
				console.log(
					'❌ Channel kontrak tidak ditemukan atau belum diatur.',
				);
			}

			const manajerLogChannel = message.guild.channels.cache.get(
				settings.channelLog,
			);

			if (!manajerLogChannel) {
				console.log(
					'❌ Channel log manajer tidak ditemukan atau belum diatur.',
				);
			}

			const managerRoles = settings.roles?.manager || [];
			if (!managerRoles.length) return;

			const roleMentions = managerRoles
				.map((id) => `<@&${id}>`)
				.join(' ');

			const driver = await DriverRegistry.findOne({
				guildId,
				truckyId: truckyId,
			});

			if (!driver) {
				console.log('⚠️ Driver belum ter-register, skip counting.');
				// 📢 Log ke channel
				if (manajerLogChannel) {
					manajerLogChannel.send({
						content:
							`${roleMentions}\n` +
							`⚠️ Driver **${truckyName}** (Trucky ID: ${truckyId}) memulai job, namun belum terdaftar di sistem. Mohon untuk didaftarkan.`,
					});
				}
				return;
			}

			const discordId = driver.userId;
			const gameName = mapGame(job.game_id);
			const marketType = formatMarketType(job.market);

			if (job.driver.id !== driver.truckyId) {
				console.log(
					'⚠️ Driver ID dari job tidak sesuai dengan driver terdaftar, skip counting.',
				);
				return;
			}

			// Cek apakah ada job ongoing lain untuk driver ini
			const existingJob = await JobHistory.findOne({
				guildId,
				driverId: discordId,
				gameId: gameId,
				jobStatus: 'ONGOING',
			});

			if (existingJob && existingJob.jobId !== jobId) {
				await JobHistory.updateOne(
					{ _id: existingJob._id },
					{
						jobStatus: 'CANCELED',
						completedAt: new Date(),
						error: 'START_NEW_JOB',
					},
				);

				// 🔥 APPLY PENALTY
				if (!existingJob.cancelPenaltyApplied) {
					await applyCancelPenalty({
						guildId,
						userId: discordId,
						jobId: existingJob.jobId,
						managerId: __client__.user.id,
					});

					await notifyPointResult({
						client: __client__,
						guildId,
						userId: discordId,
						type: 'penalty',
						points: PENALTY_POINTS,
						// PERBAIKAN 3: Gunakan existingJob.jobId agar pinalti masuk ke ID lama yang dibatalkan
						jobId: existingJob.jobId,
						reason: `Pinalti Pembatalan Pekerjaan: Memulai Pekerjaan baru (#${jobId}) sebelum menyelesaikan pekerjaan sebelumnya (#${existingJob.jobId})`,
					});

					await JobHistory.updateOne(
						{ _id: existingJob._id },
						{ cancelPenaltyApplied: true },
					);
				}
			}

			// Cek apakah job sudah ada di history
			const alreadyExists = await JobHistory.findOne({
				guildId,
				jobId,
				gameId: gameId,
				driverId: discordId,
			});

			if (alreadyExists) {
				console.log(`[JOB START IGNORED] Job ${jobId} already exists`);
				return;
			}

			// Simpan ke JobHistory
			await JobHistory.create({
				guildId,
				jobId,
				driverId: discordId,
				truckyId,
				gameId: gameId,
				game: gameName,
				gameMode: job.game_mode || 'sp',
				marketType: marketType,
				sourceCity: job.source_city_name,
				destinationCity: job.destination_city_name,
				sourceCompany: job.source_company_name,
				destinationCompany: job.destination_company_name,
				vehicle: {
					brand:
						job.vehicle_brand_name ||
						job.vehicle?.model?.brand?.name ||
						'Rental / Unknown',
					model:
						job.vehicle_model_name ||
						job.vehicle?.vehicle_name ||
						'Rental Vehicle',
				},
				vehicleId: job.vehicle_id || null,
				cargoName: job.cargo_name,
				cargoMass: job.cargo_mass_t ?? 0,
				plannedDistanceKm: job.planned_distance_km,
				jobStatus: 'ONGOING',
				status: 'ongoing',
				startedAt: new Date(),
			});

			// PERBAIKAN 2: Pindahkan waktu ke luar scope agar aman digunakan oleh Embed User reguler maupun spesial
			const actualCreatedAt = Math.floor(
				new Date(job.created_at).getTime() / 1000,
			);

			// ==========================================================
			//  ⭐ SPECIAL CONTRACT LOGIC
			// ==========================================================
			const contract = await Contract.findOne({
				guildId,
				gameId: gameId,
			});

			let isSpecialContract = false;

			if (contract) {
				const source = job.source_company_name || '';
				const destination = job.destination_company_name || '';
				const contractName = contract.companyName.toLowerCase();

				if (
					source.toLowerCase() === contractName ||
					destination.toLowerCase() === contractName
				) {
					isSpecialContract = true;
					await JobHistory.findOneAndUpdate(
						{ guildId, jobId, gameId: gameId, driverId: discordId },
						{ $set: { isSpecialContract: true } },
						{ new: true },
					);

					const embedReport = new EmbedBuilder()
						.setTitle(`🚛 Special Contract Started! - Job ${jobId}`)
						.setColor('Yellow')
						.setAuthor({
							name: job.driver.name,
							iconURL: job.driver.avatar_url,
							url: job.driver.public_url,
						})
						.addFields(
							{
								name: '🚛 Driver',
								value: `<@${discordId}>`,
								inline: true,
							},
							{
								name: '🏢 Perusahaan Awal',
								value: job.source_company_name,
								inline: true,
							},
							{
								name: '🏭 Perusahaan Tujuan',
								value: job.destination_company_name,
								inline: true,
							},
							{
								name: '🗺️ Rute',
								value: `${job.source_city_name} → ${job.destination_city_name} (${job.planned_distance_km} Km)`,
							},
							{
								name: '🧾 Kargo',
								value: `${job.cargo_name} (${job.cargo_mass_t} t)`,
								inline: true,
							},
							{
								name: '📆 Dimulai Pada',
								value: `<t:${actualCreatedAt}:F>`,
								inline: true,
							},
							{ name: '🌐 World', value: mapGame(gameId) },
						)
						.setURL(job.public_url)
						.setThumbnail(job.driver.avatar_url)
						.setTimestamp();

					// Menggunakan Optional Chaining yang lebih aman untuk proteksi truk rental (null crash)
					const footerBrand =
						job.vehicle_brand_name ||
						job.vehicle?.model?.brand?.name ||
						'Rental Vehicle';
					const footerModel =
						job.vehicle_model_name ||
						job.vehicle?.vehicle_name ||
						'Quick Job';
					const footerIcon =
						job.vehicle?.model?.brand?.logo_url ||
						'https://i.imgur.com/FljyDVl.png';

					embedReport.setFooter({
						text: `${footerBrand} - ${footerModel}`,
						iconURL: footerIcon,
					});

					if (notifyChannel) {
						await notifyChannel.send({ embeds: [embedReport] });
					}
				}
			}

			// Ambil URL logo jika ada (kalau tidak ada, parameter akan diabaikan)
			const companyLogoUrl = job.company?.avatar
				? `https://cdn.truckyapp.com/${job.company.avatar}`
				: null;

			// Generate Buffer Surat Jalan
			const pdfBuffer = await buildDeliveryOrder(
				job,
				truckyName,
				companyLogoUrl,
			);

			// Siapkan attachment Discord
			const doAttachment = new AttachmentBuilder(pdfBuffer, {
				name: `Delivery-Order-${jobId}-${truckyName}.pdf`,
			});

			// Send embed to User
			const embedUser = new EmbedBuilder()
				.setTitle(
					`🚛 ${isSpecialContract ? 'Special Contract' : 'Regular'} Job Started! - Job #${jobId}`,
				)
				.setColor('Green')
				.setDescription(
					`Kami mencatat bahwa Anda telah memulai job ${isSpecialContract ? 'kontrak spesial' : 'reguler'}.\n` +
						`Pastikan untuk menyelesaikan job ini untuk mendapatkan reward dan menjaga reputasi Anda!` +
						`\n\n**Detail Job:**`,
				)
				.addFields(
					{
						name: '🏢 Perusahaan Awal',
						value: job.source_company_name,
						inline: true,
					},
					{
						name: '🏭 Perusahaan Tujuan',
						value: job.destination_company_name,
						inline: true,
					},
					{
						name: '🗺️ Rute',
						value: `${job.source_city_name} → ${job.destination_city_name} (${job.planned_distance_km} Km)`,
					},
					{
						name: '🧾 Kargo',
						value: `${job.cargo_name} (${job.cargo_mass_t} t)`,
						inline: true,
					},
					{
						name: '📆 Dimulai Pada',
						value: `<t:${actualCreatedAt}:F>`,
					},
					{
						name: '🌐 World',
						value: mapGame(gameId),
					},
				)
				.setTimestamp()
				.setThumbnail(message.guild.iconURL({ forceStatic: false }));

			__client__.users
				.send(discordId, { embeds: [embedUser], files: [doAttachment] })
				.catch(() => {});
		} catch (err) {
			console.error('❌ Detect Start Job error:', err);
		}
	},
}).toJSON();

function mapGame(game) {
	if (game === 1 || game === '1') return 'Euro Truck Simulator 2';
	if (game === 2 || game === '2') return 'American Truck Simulator';
	return 'Unknown';
}

function formatMarketType(type) {
	if (!type) return 'Unknown';

	return type
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1)) // ["External", "Market"]
		.join(' ');
}
