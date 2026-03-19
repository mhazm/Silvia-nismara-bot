const GuildSettings = require('../models/guildsetting');
const CouponHistory = require('../models/couponHistory');
const Coupon = require('../models/coupon');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startCouponWatcher(client) {
    console.log('🔄 Coupon Watcher started...');

    setInterval(async () => {
        try {
            const now = new Date();

            // Cari event yang sudah berakhir
            const events = await Coupon.find({
                validUntil: { $lte: now },
            });

            if (!events.length) return;

            for (const ev of events) {
                const durationDays = ev.validUntil
                    ? Math.ceil((ev.validUntil - ev.setAt) / (1000 * 60 * 60 * 24))
                    : 'N/A';

                await CouponHistory.create({
                    guildId: ev.guildId,
                    nameCoupon: ev.nameCoupon,
                    codeCoupon: ev.codeCoupon,
                    minAmount: ev.minAmount,
                    maxAmount: ev.maxAmount,
                    imageUrl: ev.imageUrl,

                    startDate: ev.setAt,
                    endDate: ev.validUntil,
                    closedAt: new Date(),
                    setBy: ev.setBy,
                    durationDays: durationDays,

                    totalNcClaimed: ev.totalNcClaimed,

                    driverClaims: ev.driverClaims || [],
                });

                let participantCount = 0;
                if (ev.driverClaims && ev.driverClaims.length) {
                    participantCount = ev.driverClaims.length;
                }

                const guild = client.guilds.cache.get(ev.guildId);
                if (!guild) {
                    await Coupon.deleteOne({ _id: ev._id });
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
                        const embed = new EmbedBuilder()
                            .setTitle(
                                `🔔 Special Coupon ${ev.nameCoupon} telah berakhir`,
                            )
                            .setColor('Red')
                            .setDescription(
                                `Special Coupon **${ev.nameCoupon}** dengan kode **${ev.codeCoupon}** yang berjalan sejak <t:${Math.floor(ev.setAt.getTime() / 1000)}:F> telah resmi berakhir.`,
                            )
                            .addFields(
                                {
                                    name: '📊 Statistik Akhir',
                                    value:
                                        `• **Total N¢ diklaim**: ${ev.totalNcClaimed.toLocaleString()} N¢\n` +
                                        `• **Total Partisipan**: ${participantCount} driver`,
                                },
                            )
                            .setTimestamp();

                        await channel.send({ embeds: [embed] });
                    }
                }

                // 🔹 Hapus event aktif
                await Coupon.deleteOne({ _id: ev._id });

                console.log(
                    `✅ Special Coupon ${ev.nameCoupon} expired & history closed for guild ${ev.guildId}`,
                );
            }
        } catch (err) {
            console.error('❌ Event watcher error:', err);
        }
    }, 60_000); // cek tiap 1 menit
};