const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
	PermissionsBitField,
} = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DiscordBot = require('../../client/DiscordBot');
const GuildSettings = require('../../models/guildsetting');
const JobHistory = require('../../models/jobhistory');

module.exports = new ApplicationCommand({
	command: {
		name: 'recheckjob',
		description:
			'Melakukan pengecekan ulang job di Trucky API dan mengirimkan embed webhook ke channel job-tracker',
		options: [
			{
				name: 'jobid',
				description: 'ID Job Trucky',
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

		const jobId = interaction.options.getString('jobid');

		try {
			const guildSettings = await GuildSettings.findOne({
				guildId: interaction.guild.id,
			});
			if (!guildSettings || !guildSettings.truckyWebhookChannel) {
				return interaction.editReply(
					'❌ Channel job-tracker belum diatur di database.',
				);
			}

			const trackerChannel = interaction.guild.channels.cache.get(
				guildSettings.truckyWebhookChannel,
			);
			if (!trackerChannel) {
				return interaction.editReply(
					'❌ Channel job-tracker tidak ditemukan di server.',
				);
			}

			// 2. Lakukan request ke Trucky API untuk mendapatkan detail job
			const companyId = process.env.TRUCKY_COMPANY_ID;
			const apiKey = process.env.TRUCKY_API_KEY;

			// Catatan: Jika ada fungsi fetch khusus di src/services/trucky.service.js, bisa digunakan di sini.
			// Gunakan API endpoint Trucky untuk mengecek single job history
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
				return interaction.editReply(
					`❌ Gagal mengambil data dari Trucky API. Status Code: ${res.status}`,
				);
			}

			const jobData = await res.json();

			if (!jobData) {
				return interaction.editReply(
					'❌ Job tidak ditemukan di sistem API Trucky.',
				);
			}

			// 3. Tentukan status job dari Trucky
			// Cek apakah status dari Trucky sudah selesai, jika ya jadikan 'Job Completed'
			const isCompleted = jobData.status === 'completed';
			const embedTitle = isCompleted ? 'Job Completed' : 'Job Started';
			const embedColor = isCompleted ? '#00FF00' : '#FFA500';

			const jobDb = await JobHistory.findOne({
				guildId: interaction.guild.id,
				jobId: jobData.id,
			});

			let startedEmbedSent = false;

			if (!jobDb) {
				const startedJobEmbed = new EmbedBuilder()
					.setTitle(`Job Started - #${jobData.id}`)
					.setColor(embedColor)
					.addFields(
						{
							name: `🗺️ ${jobData.source_city_name} to ${jobData.destination_city_name}`,
							value: `${jobData.planned_distance_km} (Planned)`,
							inline: true,
						},
						{
							name: `Cargo`,
							value: `${jobData.cargo_name}`,
							inline: true,
						},
						{
							name: `🚚 Truck`,
							value: `${jobData.vehicle_brand_name} ${jobData.vehicle_model_name}`,
							inline: true,
						},
					)
					.setTimestamp();

				await trackerChannel.send({ embeds: [startedJobEmbed] });
				startedEmbedSent = true;
			}

			if (isCompleted) {
				if (startedEmbedSent) {
					console.log(
						`[RecheckJob] Memberikan jeda 20 detik untuk Job ID ${jobData.id} agar database siap...`,
					);
					await new Promise((resolve) => setTimeout(resolve, 20000));
				}

				const webhookEmbed = new EmbedBuilder()
					.setTitle(`${embedTitle} - #${jobData.id}`)
					.setColor(embedColor)
					.setTimestamp();

				await trackerChannel.send({ embeds: [webhookEmbed] });
			}

			const responseMessage =
				startedEmbedSent && isCompleted
					? `✅ Berhasil mengecek ulang Job ID **${jobId}**.\nEmbed **Job Started** telah dikirim. Mengingat job ini sudah selesai, embed **Job Completed** juga telah dikirim setelah jeda 20 detik agar sinkronisasi database aman!`
					: `✅ Berhasil mengecek ulang Job ID **${jobId}**.\nEmbed webhook buatan untuk Job **${jobId}** telah dikirim ke channel tracker.`;

			return interaction.editReply(responseMessage);
		} catch (error) {
			console.error('[Command: recheckjob] Error:', error);
			return interaction.editReply(
				'❌ Terjadi kesalahan saat memproses command recheckjob.',
			);
		}
	},
}).toJSON();
