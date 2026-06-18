const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DriverRegistry = require('../../models/driverlink');
const Point = require('../../models/points');
const Currency = require('../../models/currency');
const ActiveJob = require('../../models/activejob');
const NCEvent = require('../../models/ncevent');

module.exports = new ApplicationCommand({
	command: {
		name: 'checkjob',
		description: 'Cek detail job + simulasi NC berdasarkan Job ID Trucky',
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
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const jobId = interaction.options.getString('jobid');
			const guildId = interaction.guild.id;

			// =========================
			// FETCH JOB
			// =========================
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

			if (!res.ok)
				return interaction.editReply('❌ Job ID tidak ditemukan.');

			const job = await res.json();
			if (!job?.driver?.id)
				return interaction.editReply('❌ Data job tidak valid.');

			// =========================
			// DRIVER & BASIC DATA
			// =========================
			const driver = await DriverRegistry.findOne({
				guildId,
				truckyId: job.driver.id,
			});

			const jobCompanySource = job?.source_company_name || 'N/A';
			const jobCitySource = job?.source_city_name || 'N/A';
			const jobCompanyDestination =
				job?.destination_company_name || 'N/A';
			const jobCityDestination = job?.destination_city_name || 'N/A';
			const jobCargoName = job?.cargo_name || 'N/A';
			const jobCargoMass = Number(job?.cargo_mass_t || 0);
			const jobPlannedDistance = Number(job?.planned_distance_km || 0);
			const jobDrivenDistance = Number(job?.real_driven_distance_km || 0);
			const truckyRevenue = Number(job?.revenue || 0);
			const jobStatus = job?.status || 'N/A';
			const jobStatsType = formatStatsType(job?.stats_type);

			const discordId = driver?.userId;
			const currency = discordId
				? await Currency.findOne({ guildId, userId: discordId })
				: null;
			const pointDb = discordId
				? await Point.findOne({ guildId, userId: discordId })
				: null;

			const totalNCNow = currency?.totalNC ?? 0;
			const totalPenaltyNow = pointDb?.totalPoints ?? 0;

			// =========================
			// GAME MODE
			// =========================
			const gameMode = formatGameMode(job.game_mode);
			const km = jobDrivenDistance;

			// =========================
			// NC CALCULATION (SIMULASI)
			// =========================
			let nc = {
				base: 0,
				special: 0,
				hardcore: 0,
				event: 0,
				total: 0,
			};

			const activeSC = discordId
				? await ActiveJob.findOne({
						guildId,
						driverId: discordId,
						jobId: String(jobId),
						active: true,
					})
				: null;

			const isSpecialContract = Boolean(activeSC);

			if (isSpecialContract) {
				nc.special = Math.round(km * 2);
			} else {
				nc.base = Math.round(km * 1);
			}

			const isHardcore =
				job.realistic_ldb_points > 0 ||
				job.realistic_leaderboard === true;

			if (isHardcore) {
				nc.hardcore = Math.round(km * 1);
			}

			const activeEvent = await NCEvent.findOne({ guildId });
			if (activeEvent && activeEvent.endAt > new Date()) {
				nc.event = Math.round(km * activeEvent.multiplier);
			}

			nc.total = Math.round(
				nc.base + nc.special + nc.hardcore + nc.event,
			);

			// =========================
			// PENALTY
			// =========================
			const vehiclePenalty = calcVehiclePenalty(job.vehicle_damage ?? 0);
			const trailerPenalty = calcTrailerPenalty(job.trailers_damage ?? 0);
			const cargoPenalty = calcCargoPenalty(job.cargo_damage ?? 0);
			const distancePenalty = calcDistancePenalty(km);
			const speedPenalty = calcSpeedPenalty(job.stats_type);

			const totalPenalty =
				vehiclePenalty +
				trailerPenalty +
				cargoPenalty +
				distancePenalty +
				speedPenalty;

			// =========================
			// EMBED FIELDS
			// =========================
			const fields = [
				{
					name: '🏢 Dari',
					value: `${jobCompanySource} (${jobCitySource})`,
				},
				{
					name: '🏢 Tujuan',
					value: `${jobCompanyDestination} (${jobCityDestination})`,
				},
				{
					name: '📦 Kargo',
					value: `${jobCargoName} (${jobCargoMass}t)`,
				},
				{
					name: '🛣️ Jarak Rencana',
					value: `${jobPlannedDistance} km`,
					inline: true,
				},
				{
					name: '🚚 Jarak Dijalankan',
					value: `${jobDrivenDistance} km`,
					inline: true,
				},
				{
					name: '💰 Revenue Trucky',
					value: `${Math.round(truckyRevenue)} T¢`,
				},
			];

			// NC detail (conditional)
			if (nc.base > 0)
				fields.push({
					name: '🪙 Base NC',
					value: `+${nc.base} N¢`,
					inline: true,
				});
			if (nc.special > 0)
				fields.push({
					name: '⭐ Special Contract NC',
					value: `+${nc.special} N¢`,
					inline: true,
				});
			if (nc.hardcore > 0)
				fields.push({
					name: '🔥 Hardcore Bonus',
					value: `+${nc.hardcore} N¢`,
					inline: true,
				});
			if (nc.event > 0)
				fields.push({
					name: '🎉 Event Bonus',
					value: `+${nc.event} N¢`,
					inline: true,
				});

			fields.push({
				name: '🪙 Total NC Earned',
				value: `+${nc.total} N¢`,
				inline: true,
			});

			// Penalty fields
			if (vehiclePenalty > 0)
				fields.push({
					name: '🚗 Vehicle Damage',
					value: `${job.vehicle_damage}% → ${vehiclePenalty} pts`,
					inline: true,
				});
			if (trailerPenalty > 0)
				fields.push({
					name: '🚛 Trailer Damage',
					value: `${job.trailers_damage}% → ${trailerPenalty} pts`,
					inline: true,
				});
			if (cargoPenalty > 0)
				fields.push({
					name: '📦 Cargo Damage',
					value: `${job.cargo_damage}% → ${cargoPenalty} pts`,
					inline: true,
				});
			if (speedPenalty > 0)
				fields.push({
					name: '⚡ Speed Penalty',
					value: `${formatStatsType(
						job.stats_type,
					)} → ${speedPenalty} pts`,
					inline: true,
				});

			// =========================
			// DESCRIPTION
			// =========================
			const description =
				`👤 Discord: <@${discordId}>\n` +
				`🚛 Driver: **${job.driver.name}**\n` +
				`🕹️ Mode: **${gameMode}**\n\n` +
				`📊 Status Job: **${jobStatus}**\n` +
				`🕹️ Stats Type: **${jobStatsType}**\n` +
				(totalPenalty > 0
					? `⚠️ Job ini menghasilkan **${totalPenalty} penalty points**.\nTotal penalty driver saat ini: **${totalPenaltyNow} points**`
					: `✅ Job ini **tanpa penalty**.`);

			// =========================
			// EMBED
			// =========================
			const embed = new EmbedBuilder()
				.setTitle(`💼 Job Report — #${jobId}`)
				.setColor(totalPenalty > 0 ? 'Red' : 'Green')
				.setDescription(description)
				.addFields(fields)
				.setThumbnail(job.driver.avatar_url)
				.setURL(job.public_url)
				.setTimestamp();

			if (discordId) {
				embed.addFields(
					{
						name: '🏦 Total NC Driver Saat Ini',
						value: `${totalNCNow} N¢`,
						inline: true,
					},
					{
						name: '🧾 Total Penalty Saat Ini',
						value: `${totalPenaltyNow} points`,
						inline: true,
					},
				);
			}

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error(err);
			await interaction.editReply('❌ Terjadi error.');
		}
	},
}).toJSON();

/* =========================
   HELPERS
========================= */

function calcVehiclePenalty(dmg) {
	if (dmg < 11) return 0;
	return 1 + Math.floor((dmg - 10) / 5);
}
function calcTrailerPenalty(dmg) {
	if (dmg < 8) return 0;
	return 1 + Math.floor((dmg - 7) / 7);
}
function calcCargoPenalty(dmg) {
	if (dmg < 6) return 0;
	return 1 + Math.floor((dmg - 5) / 5);
}
function calcDistancePenalty(distance) {
	if (distance < 151) return 1;
	return 0;
}
function calcSpeedPenalty(type) {
	if (type === 'race_miles') return 2;
	return 0;
}
function formatStatsType(type) {
	if (!type) return 'Unknown';
	return type
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}
function formatGameMode(mode) {
	const map = {
		sp: '🎮 Single Player',
		truckersmp: '🌐 TruckersMP',
	};
	return map[mode] || `❓ ${mode || 'Unknown'}`;
}
