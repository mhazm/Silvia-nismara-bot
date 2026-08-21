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
            console.log('[AI History Watcher] Syncing Redis histories to MongoDB...');
            
            // Get all keys matching ai_chat:*
            const keys = await redisClient.keys('ai_chat:*');
            if (!keys.length) return;

            for (const key of keys) {
                const discordId = key.split(':')[1];
                const historyStr = await redisClient.get(key);
                
                if (historyStr) {
                    const history = JSON.parse(historyStr);
                    // Upsert to MongoDB
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
            console.log(`[AI History Watcher] Successfully synced ${keys.length} chats to MongoDB.`);
        } catch (error) {
            console.error('[AI History Watcher] Sync error:', error);
        }
    }, 60 * 60 * 1000); // 1 jam
};
