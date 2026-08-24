const GuildSettings = require('../models/guildsetting');
const Coupon = require('../models/coupon');
const { EmbedBuilder } = require('discord.js');

module.exports = async function startCouponWatcher(client) {
    console.log('🔄 Coupon Watcher started...');

    setInterval(async () => {
        try {
            const now = new Date();

            // 🔹 Cari event yang dijadwalkan dan waktunya sudah mulai
            const scheduledEvents = await Coupon.find({
                startDate: { $lte: now },
                isScheduled: true,
            });

            for (const ev of scheduledEvents) {
                const guild = client.guilds.cache.get(ev.guildId);
                if (!guild) {
                    ev.isScheduled = false; 
                    await ev.save();
                    continue;
                }

                ev.isActive = true;
                ev.isScheduled = false;
                await ev.save();

                const settings = await GuildSettings.findOne({
                    guildId: ev.guildId,
                });

                if (settings?.eventNotifyChannel) {
                    const channel = guild.channels.cache.get(
                        settings.eventNotifyChannel,
                    );

                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setTitle(`🎉 Special Coupon ${ev.nameCoupon} Resmi Dimulai!`)
                            .setColor('Green')
                            .setDescription(
                                `Kupon Terjadwal **${ev.nameCoupon}** sekarang sudah aktif dan bisa diklaim! (Kode: ||${ev.codeCoupon}||)`
                            )
                            .addFields(
                                {
                                    name: '💰 Reward',
                                    value: `${ev.minAmount || 0} - ${ev.maxAmount || 0} ${ev.type === 'PENALTY_TICKET' ? 'Tiket' : 'N¢'}`,
                                },
                                {
                                    name: '📅 Berakhir Pada',
                                    value: `<t:${Math.floor(ev.endDate.getTime() / 1000)}:F>`,
                                }
                            )
                            .setFooter({
                                text: `Ketik /claim ${ev.codeCoupon} untuk mengklaim kupon ini!`,
                            })
                            .setTimestamp();
                        
                        if (ev.imageUrl) embed.setImage(ev.imageUrl);

                        await channel.send({ embeds: [embed] });
                    }
                }
                console.log(`✅ Scheduled Coupon ${ev.nameCoupon} started for guild ${ev.guildId}`);
            }

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