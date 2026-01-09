const Event = require('../../structure/Event');
const DriverRegistry = require('../../models/driverlink');
const GuildSettings = require('../../models/guildsetting');
const JobHistory = require('../../models/jobHistory');
const {
	applyCancelPenalty,
} = require('../../services/cancelJobPenalty.service');
const {
	notifyPointResult,
} = require('../../services/cancelJobNotify.service');

const fetch = global.fetch || require('node-fetch');

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
			/* =========================
			   BASIC VALIDATION
			========================= */
			if (!message.guild) return;

			const settings = await GuildSettings.findOne({
				guildId: message.guild.id,
			});
			if (!settings?.truckyWebhookChannel) return;
			if (message.channel.id !== settings.truckyWebhookChannel) return;
			if (!message.webhookId) return;
			if (!message.embeds?.length) return;

			const embed = message.embeds[0];
			if (!embed.title?.includes('Job Canceled')) return;

			/* =========================
			   PARSE JOB ID
			========================= */
			const match = embed.title.match(/#(\d+)/);
			if (!match) return;

			const jobId = match[1];
			const guildId = message.guild.id;

			console.log(`❌ Job Canceled detected: #${jobId}`);

			/* =========================
			   FETCH JOB FROM TRUCKY
			========================= */
			const res = await fetch(
				`https://e.truckyapp.com/api/v1/job/${jobId}`,
				{
					headers: {
						'x-access-token': process.env.TRUCKY_API_KEY,
						Accept: 'application/json',
						'User-Agent': 'Mozilla/5.0',
					},
				},
			);

			if (!res.ok) {
				console.log('❌ Job not found on Trucky API');
				return;
			}

			const job = await res.json();
			const truckyId = job.driver?.id;
			const truckyName = job.driver?.name;

			if (!truckyId || !truckyName) return;

			/* =========================
			   MAP DRIVER
			========================= */
			const driver = await DriverRegistry.findOne({
				guildId,
				truckyId,
			});

			if (!driver) {
				console.log('⚠️ Driver not registered, skip penalty');
				return;
			}

			const discordId = driver.userId;
			const PENALTY_POINTS = 5;

			/* =========================
			   FIND PREVIOUS ONGOING JOB
			   (MODEL-AWARE)
			========================= */
			const previousJob = await JobHistory.findOne({
				guildId,
				driverId: discordId,
				truckyId,
				jobStatus: 'ONGOING',
				cancelPenaltyApplied: false,
				jobId: { $ne: jobId },
			});

			if (!previousJob) {
				console.log(
					`ℹ️ No ongoing job to cancel for ${truckyName}`,
				);
				return;
			}

			/* =========================
			   ATOMIC CANCEL UPDATE
			   (ANTI RACE-CONDITION)
			========================= */
			const updatedJob = await JobHistory.findOneAndUpdate(
				{
					_id: previousJob._id,
					cancelPenaltyApplied: false,
				},
				{
					jobStatus: 'CANCELED',
					completedAt: new Date(),
					error: 'START_NEW_JOB',
					cancelPenaltyApplied: true,
					status: 'completed',
				},
				{ new: true },
			);

			if (!updatedJob) {
				console.log(
					'⚠️ Job already processed by another handler',
				);
				return;
			}

			/* =========================
			   APPLY PENALTY
			========================= */
			await applyCancelPenalty({
				guildId,
				userId: discordId,
				jobId: updatedJob.jobId,
				managerId: client.user.id,
			});

			await notifyPointResult({
				client: __client__,
				guildId,
				userId: discordId,
				type: 'penalty',
				points: PENALTY_POINTS,
				jobId: updatedJob.jobId,
				reason: `Cancel Job Penalty: Started new job (#${jobId}) before completing previous job (#${updatedJob.jobId})`,
			});

			console.log(
				`⚠️ Penalty applied: +${PENALTY_POINTS} points to ${truckyName}`,
			);
		} catch (err) {
			console.error('❌ Job Canceled handler error:', err);
		}
	},
}).toJSON();