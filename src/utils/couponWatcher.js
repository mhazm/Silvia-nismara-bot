const GuildSettings = require('../models/guildsetting');
const Coupon = require('../models/coupon');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startCouponWatcher(client) {
    console.log('🔄 Coupon Watcher started...');

    setInterval(async () => {
        try {
            const now = new Date();

            // Cari event yang sudah berakhir
            const events = await Coupon.find({
                endDate: { $lte: now },
                isActive: true,
            });

            if (!events.length) return;

            for (const ev of events) {
                let participantCount = 0;
                if (ev.driverClaims && ev.driverClaims.length) {
                    participantCount = ev.driverClaims.length;
                }

                const guild = client.guilds.cache.get(ev.guildId);
                if (!guild) {
                    ev.isActive = false;
                    await ev.save();
                    continue;
                }

                const settings = await GuildSettings.findOne({
                    guildId: ev.guildId,
                });

                if (settings?.eventNotifyChannel) {
                    const channel = guild.channels.cache.get(
                        settings.eventNotifyChannel,
                    );

                    if (channel) {
                        let statsValue = '';
                        const totalClaimed = (ev.driverClaims || []).reduce((sum, claim) => sum + (claim.amount || 0), 0);
                        if (ev.type === 'PENALTY_TICKET') {
                            statsValue = `• **Total Tiket Penalty diklaim**: ${totalClaimed} Tiket\n`;
                        } else {
                            statsValue = `• **Total N¢ diklaim**: ${totalClaimed.toLocaleString()} N¢\n`;
                        }
                        statsValue += `• **Total Partisipan**: ${participantCount} driver`;

                        const embed = new EmbedBuilder()
                            .setTitle(
                                `🔔 Special Coupon ${ev.nameCoupon} telah berakhir`,
                            )
                            .setColor('Red')
                            .setDescription(
                                `Special Coupon **${ev.nameCoupon}** dengan kode **${ev.codeCoupon}** yang berjalan sejak <t:${Math.floor(ev.startDate.getTime() / 1000)}:F> telah resmi berakhir.`,
                            )
                            .addFields(
                                {
                                    name: '📊 Statistik Akhir',
                                    value: statsValue,
                                },
                            )
                            .setTimestamp();

                        await channel.send({ embeds: [embed] });
                    }
                }

                // 🔹 Nonaktifkan event aktif
                ev.isActive = false;
                await ev.save();

                console.log(
                    `✅ Special Coupon ${ev.nameCoupon} expired & closed for guild ${ev.guildId}`,
                );
            }
        } catch (err) {
            console.error('❌ Event watcher error:', err);
        }
    }, 60_000); // cek tiap 1 menit
};