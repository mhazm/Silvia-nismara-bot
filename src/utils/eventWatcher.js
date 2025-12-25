const NCEvent = require("../models/ncevent");
const GuildSettings = require("../models/guildsetting");
const { EmbedBuilder } = require("discord.js");

module.exports = async function startEventWatcher(client) {
    console.log("🔄 NC Event Watcher started...");

    setInterval(async () => {
        try {
            const now = new Date();
            const events = await NCEvent.find({ endAt: { $lte: now } });

            if (events.length === 0) return;

            for (const ev of events) {
                const guild = client.guilds.cache.get(ev.guildId);
                if (!guild) continue;

                const settings = await GuildSettings.findOne({ guildId: ev.guildId });
                if (!settings || !settings.eventNotifyChannel) continue;

                const channel = guild.channels.cache.get(settings.eventNotifyChannel);
                if (!channel) continue;

                const embed = new EmbedBuilder()
                    .setTitle("🔔 NC Boost Event Telah Berakhir!")
                    .setColor("Red")
                    .setDescription(
                        `Event NC Boost dengan multiplier **x${ev.multiplier}** telah resmi berakhir.\n\n` +
                        `Terimakasih telah berpartisipasi! 🚚💨`
                    )
                    .setTimestamp();

                channel.send({ embeds: [embed] });

                // hapus event setelah notifikasi
                await NCEvent.deleteOne({ _id: ev._id });

                console.log(`⚠️ NC Event expired & notified for guild ${ev.guildId}`);
            }
        } catch (err) {
            console.error("❌ Event watcher error:", err);
        }
    }, 60_000); // cek tiap 1 menit
};