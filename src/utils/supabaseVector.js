const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// Initialize Gemini and Supabase
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
	supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
} else {
	console.warn(
		'[Supabase Vector] Missing SUPABASE_URL or SUPABASE_KEY in .env',
	);
}

/**
 * Generate embedding for a given text using Gemini
 */
async function generateEmbedding(text) {
	try {
		const model = genAI.getGenerativeModel({ model: 'text-embedding-001' });
		const result = await model.embedContent(text);
		return result.embedding.values;
	} catch (error) {
		console.error('[Supabase Vector] Error generating embedding:', error);
		return null;
	}
}

/**
 * Search past memories based on semantic similarity
 */
async function searchPastMemories(prompt, discordIds) {
	if (!supabase) return [];

	try {
		const embedding = await generateEmbedding(prompt);
		if (!embedding) return [];

		const { data, error } = await supabase.rpc('match_chat_history', {
			query_embedding: embedding,
			match_threshold: 0.65, // Threshold kemiripan (0 - 1)
			match_count: 5, // Ambil top 5 chat
			filter_discord_ids: discordIds || [],
		});

		if (error) {
			console.error('[Supabase Vector] RPC Error:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('[Supabase Vector] Error searching memories:', error);
		return [];
	}
}

/**
 * Save chat to Supabase vector database
 */
async function saveChatToVector(discordId, role, content, timestamp) {
	if (!supabase) return false;

	try {
		const embedding = await generateEmbedding(content);
		if (!embedding) return false;

		const { error } = await supabase.from('chat_embeddings').insert({
			discord_id: discordId,
			role: role,
			content: content,
			embedding: embedding,
			created_at: timestamp || new Date().toISOString(),
		});

		if (error) {
			console.error('[Supabase Vector] Insert Error:', error);
			return false;
		}

		return true;
	} catch (error) {
		console.error('[Supabase Vector] Error saving chat to vector:', error);
		return false;
	}
}

module.exports = {
	generateEmbedding,
	searchPastMemories,
	saveChatToVector,
};
