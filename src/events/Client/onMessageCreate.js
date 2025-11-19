const Event = require('../../structure/Event');
const Point = require("../../models/points");
const PointHistory = require("../../models/pointhistory");
const DriverRegistry = require("../../models/driverlink");
const GuildSettings = require("../../models/guildsetting");

module.exports = new Event({
	event: 'messageCreate',
	once: false,
	run: async (__client__, message) => {
		try {
            
            const settings = await GuildSettings.findOne({ guildId: message.guild.id });
            if (!settings || !settings.truckyWebhookChannel) return;
            if (message.channel.id !== settings.truckyWebhookChannel) return;

            if (!message.webhookId) return;
            if (!message.embeds?.length) return;

            const embed = message.embeds[0];
            if (!embed.title || !embed.title.includes("Job Completed")) return;

            const match = embed.title.match(/#(\d+)/);
            if (!match) return;

            const jobId = match[1];
            const guildId = message.guild.id;

            console.log(`🚛 Detected job completed: ${jobId}`);

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
                console.log("❌ Job ID tidak valid di API");
                return;
            }

            const job = await res.json();
            if (job.status !== "completed") return;

            const truckyName = job.driver?.name;
            if (!truckyName) return;

            const driver = await DriverRegistry.findOne({
                guildId,
                truckyName: { $regex: `^${truckyName}$`, $options: "i" }
            });

            if (!driver) {
                console.log("⚠️ Driver belum ter-register, skip penalty.");
                return;
            }

            const discordId = driver.userId;

            const distance = job.real_driven_distance_km ?? 0;
            const vehicle = job.vehicle_damage ?? 0;
            const trailer = job.trailers_damage ?? 0;
            const cargo = job.cargo_damage ?? 0;

            const vehiclePenalty = calcVehiclePenalty(vehicle);
            const trailerPenalty = calcTrailerPenalty(trailer);
            const cargoPenalty = calcCargoPenalty(cargo);
            const distancePenalty = calcDistancePenalty(distance);

            const totalPenalty = vehiclePenalty + trailerPenalty + cargoPenalty + distancePenalty;

            if (totalPenalty <= 0) {
                console.log("✔ No penalty for this job.");
                return;
            }

            await Point.findOneAndUpdate(
                { guildId, userId: discordId },
                { $inc: { totalPoints: totalPenalty } },
                { upsert: true, new: true }
            );

            await PointHistory.create({
                guildId,
                userId: discordId,
                managerId: `481238111402197021`,
                points: totalPenalty,
                type: "add",
                reason: `Automatic Penalty — Job #${jobId}`
            });

            if (settings.channelLog) {
                const logChannel = message.guild.channels.cache.get(settings.channelLog);
                if (logChannel) {
                    logChannel.send(
                        `⚠️ **Automatic Penalty Applied**\n` +
                        `Driver: <@${discordId}>\n` +
                        `Job: **#${jobId}**\n` +
                        `Total: **${totalPenalty} poin**\n\n` +
                        `Vehicle: ${vehicle}% → ${vehiclePenalty} poin\n` +
                        `Trailer: ${trailer}% → ${trailerPenalty} poin\n` +
                        `Cargo: ${cargo}% → ${cargoPenalty} poin\n` +
                        `Distance: ${distance} Km → ${distancePenalty} poin`
                    );
                }
            }

            __client__.users.send(discordId,
                `⚠️ Kamu menerima **${totalPenalty} poin penalty** dari Job #${jobId}.\n` +
                `Vehicle: ${vehicle}% → ${vehiclePenalty} Poin\n` +
                `Trailer: ${trailer}% → ${trailerPenalty} Poin\n` +
                `Cargo: ${cargo}% → ${cargoPenalty} Poin\n` +
                `Distance: ${distance} Km → ${distancePenalty} Poin`
            ).catch(() => {});

        } catch (err) {
            console.error("❌ Auto penalty error:", err);
        }
	},
}).toJSON();

function calcVehiclePenalty(dmg) {
    if (dmg < 10) return 0;
    return 1 + Math.floor((dmg - 10) / 5);
}

function calcTrailerPenalty(dmg) {
    if (dmg < 7) return 0;
    return 1 + Math.floor((dmg - 7) / 7);
}

function calcCargoPenalty(dmg) {
    if (dmg < 5) return 0;
    return 1 + Math.floor((dmg - 5) / 5);
}

function calcDistancePenalty(distance) {
    if (distance < 150) return 1;
}
