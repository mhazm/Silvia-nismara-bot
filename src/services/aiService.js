const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
	StdioClientTransport,
} = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const Users = require('../models/Users');
const { createClient } = require('redis');

let mcpClient = null;
let mcpTools = [];
let geminiTools = [];
let redisClient = null;

async function initRedis() {
	if (redisClient) return;
	const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
	redisClient = createClient({ url: redisUrl });
	redisClient.on('error', (err) =>
		console.log('[AI Service] Redis Client Error:', err),
	);
	await redisClient.connect();
	console.log('[AI Service] Redis Client connected!');
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function initMcpClient() {
	if (mcpClient) return;

	console.log('[AI Service] Initializing MCP Client...');
	// Gunakan environment variable untuk path server agar fleksibel di server production (PM2)
	const mcpServerPath =
		process.env.MCP_SERVER_PATH ||
		path.resolve(__dirname, '../../../nismara-mcp-server/build/index.js');

	const transport = new StdioClientTransport({
		command: 'node',
		args: [mcpServerPath],
	});

	mcpClient = new Client(
		{
			name: 'silvia-discord-bot',
			version: '1.0.0',
		},
		{
			capabilities: {},
		},
	);

	await mcpClient.connect(transport);
	console.log('[AI Service] MCP Client connected!');

	// Fetch tools from MCP server
	const { z } = require('zod');
	const toolsResponse = await mcpClient.request(
		{ method: 'tools/list' },
		z.any(),
	);

	if (toolsResponse && toolsResponse.tools) {
		mcpTools = toolsResponse.tools;
		const functionDeclarations = mcpTools.map((tool) => {
			// Gemini API tidak menerima field "$schema", jadi kita harus membuangnya
			const params = JSON.parse(JSON.stringify(tool.inputSchema || {}));
			delete params.$schema;

			return {
				name: tool.name,
				description: tool.description,
				parameters: params,
			};
		});

		if (functionDeclarations.length > 0) {
			geminiTools = [{ functionDeclarations }];
		}
		console.log(`[AI Service] Loaded ${mcpTools.length} tools from MCP.`);
	}
}

/**
 * Handle a chat message using Gemini + MCP Tools
 * @param {import('discord.js').Message} message
 */
async function handleChat(message) {
	try {
		await initMcpClient();
		await initRedis();

		const userPrompt = message.content.replace(/<@!?\d+>/g, '').trim();
		if (!userPrompt) return;

		// Start typing indicator
		await message.channel.sendTyping();

		// KYC: Cari tahu siapa lawan bicaranya
		const discordId = message.author.id;
		const discordName = message.member
			? message.member.displayName || message.author.username
			: message.author.username;
		const userData = await Users.findOne({ discordId: discordId }).lean();

		let kycInfo = `\n\n--- KYC INFO ---\nLawan bicaramu di Discord bernama: ${discordName} (Discord ID: ${discordId}).\n`;
		if (userData) {
			kycInfo += `Ternyata dia sudah terdaftar di database Nismara! Nama aslinya: ${userData.name}. Jabatan: ${userData.isDriver ? 'Driver' : 'Non-Driver'}. TruckyID: ${userData.truckyId}. Level: ${userData.level || 0}. XP: ${userData.xp || 0}. Status Cuti: ${userData.isOnLeave ? 'Ya' : 'Tidak'}.`;
		} else {
			kycInfo += `Sepertinya orang ini belum terdaftar resmi sebagai driver di database Nismara.`;
		}

		// Initialize model per-chat session with dynamic system instruction
		const systemInstruction =
			`Kamu adalah Natasya, asisten AI untuk Nismara Transport (di Discord server ini bot bernama Silvia, tapi persona AI-mu adalah Natasya). Kamu ramah, profesional, dan membantu.

ATURAN PENTING:
Kamu DILARANG KERAS merespons permintaan atau memberikan informasi di luar konteks Nismara Transport, VTC, Euro Truck Simulator 2, American Truck Simulator, atau data yang ada di MCP. 
Jika pengguna menanyakan hal di luar konteks (seperti resep masakan, membuat gambar, coding, pelajaran sekolah, dsb), tolak dengan sopan dan beri tahu bahwa kamu hanya asisten untuk Nismara Transport. Arahkan pembicaraan kembali ke topik perusahaan atau layanan Nismara.
` + kycInfo;

		const model = genAI.getGenerativeModel({
			model: 'gemini-3.5-flash-lite',
			systemInstruction: systemInstruction,
		});

		// Get past history for this user from Redis
		const historyKey = `ai_chat:${discordId}`;
		const historyStr = await redisClient.get(historyKey);
		let history = historyStr ? JSON.parse(historyStr) : [];

		// Create initial contents array with history appended
		const contents = [
			...history,
			{ role: 'user', parts: [{ text: userPrompt }] },
		];

		const requestOptions = {};
		if (geminiTools.length > 0) {
			requestOptions.tools = geminiTools;
		}
		requestOptions.contents = contents;

		let result = await model.generateContent(requestOptions);
		let response = result.response;

		// Handle tool calls if Gemini decides to use them (bisa berkali-kali)
		while (
			response.functionCalls &&
			response.functionCalls() &&
			response.functionCalls().length > 0
		) {
			// Simpan respon model yang berisi functionCalls ke dalam riwayat
			if (response.candidates && response.candidates[0].content) {
				contents.push(response.candidates[0].content);
			}

			const calls = response.functionCalls();
			const functionResponses = [];

			for (const call of calls) {
				console.log(
					`[AI Service] Gemini is calling tool: ${call.name}`,
				);

				try {
					// Execute tool via MCP
					const { z } = require('zod');
					const toolResult = await mcpClient.request(
						{
							method: 'tools/call',
							params: {
								name: call.name,
								arguments: call.args,
							},
						},
						z.any(),
					);

					functionResponses.push({
						functionResponse: {
							name: call.name,
							response: toolResult,
						},
					});
				} catch (err) {
					console.error(
						`[AI Service] Tool error (${call.name}):`,
						err,
					);
					functionResponses.push({
						functionResponse: {
							name: call.name,
							response: {
								error: err.message || 'Internal tool error',
							},
						},
					});
				}
			}

			// Push the tool responses to history as "user" (menghindari error "Role function not supported")
			contents.push({
				role: 'user',
				parts: functionResponses,
			});

			// Lakukan request lagi dengan riwayat baru
			requestOptions.contents = contents;
			result = await model.generateContent(requestOptions);
			response = result.response;
		}

		const textResponse = response.text();
		if (textResponse) {
			// Simpan ke riwayat jangka panjang (hanya teks interaksi, hilangkan tool calls untuk hemat token)
			history.push({ role: 'user', parts: [{ text: userPrompt }] });
			history.push({ role: 'model', parts: [{ text: textResponse }] });

			// Batasi panjang riwayat agar tidak meledakkan limit token (misal: 10 pesan terakhir / 5 turn)
			if (history.length > 10) {
				history = history.slice(history.length - 10);
			}
			// Simpan ke Redis (kedaluwarsa dalam 24 jam jika tidak ada interaksi)
			await redisClient.set(historyKey, JSON.stringify(history), {
				EX: 86400,
			});

			// Discord has a 2000 char limit per message
			if (textResponse.length > 2000) {
				const chunks = textResponse.match(/[\s\S]{1,1999}/g) || [];
				for (const chunk of chunks) {
					await message.reply(chunk);
				}
			} else {
				await message.reply(textResponse);
			}
		}
	} catch (error) {
		console.error('[AI Service] Error handling chat:', error);
		await message.reply(
			'Maaf, terjadi kesalahan saat Natasya memproses permintaanmu.',
		);
	}
}

module.exports = {
	handleChat,
};
