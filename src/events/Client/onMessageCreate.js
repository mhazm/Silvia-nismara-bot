const Event = require("../../structure/Event");
const Point = require("../../models/points");
const PointHistory = require("../../models/pointhistory");
const DriverRegistry = require("../../models/driverlink");
const GuildSettings = require("../../models/guildsetting");

module.exports = new Event({
    name: "messageCreate",
    run: async (client, message) => {
        try {
            // Lewati kalau bukan di channel ini
            const settings = await GuildSettings.findOne({ guildId: message.guild.id });
            if (!settings || !settings.truckyWebhookChannel) return;
            if (message.channel.id !== settings.truckyWebhookChannel) return;

            // Lewati kalau bukan webhook
            if (!message.webhookId) return;

            // Embed Trucky wajib ada
            if (!message.embeds?.length) return;

            const embed = message.embeds[0];

            // Cek apakah ini "Job Completed"
            if (!embed.title || !embed.title.includes("Job Completed")) return;

            // Ambil Job ID dari "#1234567"
            const match = embed.title.match(/#(\d+)/);
            if (!match) return;

            const jobId = match[1];
            const guildId = message.guild.id;

            console.log(`🚛 Detected job completed: ${jobId}`);

            // Fetch detail job dari API Trucky
            const res = await fetch(`https://e.truckyapp.com/api/v1/job/${jobId}`, {
                headers: {
                    "x-access-token": process.env.TRUCKY_API_KEY,
                    "Accept": "application/json"
                }
            });

            if (!res.ok) {
                console.log("❌ Job ID tidak valid di API");
                return;
            }

            const job = await res.json();

            if (job.status !== "completed") return;

            // Ambil nama driver dari API
            const truckyName = job.driver?.name;
            if (!truckyName) return;

            // Cocokkan dengan driverregistry
            const driver = await DriverRegistry.findOne({
                guildId,
                truckyName: { $regex: `^${truckyName}$`, $options: "i" }
            });

            if (!driver) {
                console.log("⚠️ Driver belum ter-register, skip penalty.");
                return;
            }

            const discordId = driver.discordId;

            // Ambil damage data
            const vehicle = job.vehicle_damage ?? 0;
            const trailer = job.trailers_damage ?? 0;
            const cargo = job.cargo_damage ?? 0;

            // Hitung penalty
            const vehiclePenalty = calcVehiclePenalty(vehicle);
            const trailerPenalty = calcTrailerPenalty(trailer);
            const cargoPenalty = calcCargoPenalty(cargo);

            const totalPenalty = vehiclePenalty + trailerPenalty + cargoPenalty;

            if (totalPenalty <= 0) {
                console.log("✔ No penalty for this job.");
                return;
            }

            // Tambah total points
            await Point.findOneAndUpdate(
                { guildId, userId: discordId },
                { $inc: { totalPoints: totalPenalty } },
                { upsert: true, new: true }
            );

            // Simpan history
            await PointHistory.create({
                guildId,
                userId: discordId,
                managerId: client.user.id, // Bot sebagai pemberi poin
                points: totalPenalty,
                type: "add",
                reason: `Automatic Penalty — Job #${jobId}`
            });

            // Kirim log ke channel
            const settings = await GuildSettings.findOne({ guildId });
            if (settings?.channelLog) {
                const logChannel = message.guild.channels.cache.get(settings.channelLog);
                if (logChannel) {
                    logChannel.send(
                        `⚠️ **Automatic Penalty Applied**\n` +
                        `Driver: <@${discordId}>\n` +
                        `Job: **#${jobId}**\n` +
                        `Total Penalty: **${totalPenalty} poin**\n\n` +
                        `• Vehicle Damage: ${vehicle}% → ${vehiclePenalty} poin\n` +
                        `• Trailer Damage: ${trailer}% → ${trailerPenalty} poin\n` +
                        `• Cargo Damage: ${cargo}% → ${cargoPenalty} poin`
                    );
                }
            }

            // DM driver
            client.users.send(discordId,
                `⚠️ Kamu menerima **${totalPenalty} poin penalty** dari Job #${jobId}.\n` +
                `Vehicle: ${vehicle}% • Trailer: ${trailer}% • Cargo: ${cargo}%`
            ).catch(() => {});

        } catch (err) {
            console.error("❌ Auto penalty error:", err);
        }
    }
});

// ===== FUNCTION PENALTY =====

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
