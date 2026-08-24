const AIChatHistory = require('../models/AIChatHistory');
const { createClient } = require("redis");

module.exports = async function startAiHistoryWatcher(client) {
    console.log('🔄 AI Chat History Watcher started (Every 1 hour)...');

    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.log('[AI History Watcher] Redis Error:', err));
    await redisClient.connect();

    // Jalankan setiap 1 jam (3600000 ms)
    setInterval(async () => {
        try {
            console.log('[AI History Watcher] Syncing Redis histories to MongoDB and Supabase Vector...');
            
            // Get all keys matching ai_chat:*
            const keys = await redisClient.keys('ai_chat:*');
            if (!keys.length) return;

            // Import Supabase RAG util
            const { saveChatToVector } = require('./supabaseVector');

            for (const key of keys) {
                const discordId = key.split(':')[1];
                const historyStr = await redisClient.get(key);
                
                if (historyStr) {
                    let history = JSON.parse(historyStr);
                    let hasUnsynced = false;

                    // Sync to Supabase Vector
                    for (let i = 0; i < history.length; i++) {
                        const msg = history[i];
                        if (!msg.isSyncedToVector && msg.parts && msg.parts[0].text) {
                            console.log(`[Supabase Vector] Syncing new message for ${discordId} (${msg.role})...`);
                            const success = await saveChatToVector(discordId, msg.role, msg.parts[0].text);
                            if (success) {
                                msg.isSyncedToVector = true;
                                hasUnsynced = true;
                            }
                        }
                    }

                    // Jika ada perubahan status sync, update Redis kembali
                    if (hasUnsynced) {
                        await redisClient.set(key, JSON.stringify(history), { EX: 86400 });
                    }

                    // Upsert to MongoDB (Hapus properti sementara sebelum save ke Mongo agar rapi, opsional)
                    // Tapi kita simpan saja utuh agar Mongo punya track record yang sudah disync
                    await AIChatHistory.findOneAndUpdate(
                        { discordId },
                        { 
                            $set: { 
                                history,
                                lastUpdatedAt: new Date()
                            }
                        },
                        { upsert: true, new: true }
                    );
                }
            }
            console.log(`[AI History Watcher] Successfully synced ${keys.length} chats.`);
        } catch (error) {
            console.error('[AI History Watcher] Sync error:', error);
        }
    }, 60 * 60 * 1000); // 1 jam
};
