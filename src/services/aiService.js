const {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
} = require('@google/generative-ai');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
	StdioClientTransport,
} = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const Users = require('../models/Users');
const { createClient } = require('redis');
const { searchPastMemories } = require('../utils/supabaseVector');

const safetySettings = [
	{
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
];

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
		let rawTools = toolsResponse.tools;

		// Taruh search_docs di urutan pertama
		const searchIndex = rawTools.findIndex((t) => t.name === 'search_docs');
		if (searchIndex > -1) {
			const searchTool = rawTools.splice(searchIndex, 1)[0];
			rawTools.unshift(searchTool);
		}

		mcpTools = rawTools;
		const functionDeclarations = mcpTools.map((tool) => {
			const params = JSON.parse(JSON.stringify(tool.inputSchema || {}));
			delete params.$schema;

			// Gemini API expects SchemaType in uppercase (e.g., 'OBJECT', 'STRING')
			const convertTypesToUpper = (obj) => {
				if (!obj || typeof obj !== 'object') return;
				if (obj.type && typeof obj.type === 'string') {
					obj.type = obj.type.toUpperCase();
				}
				if (obj.properties) {
					for (const key in obj.properties) {
						convertTypesToUpper(obj.properties[key]);
					}
				}
				if (obj.items) {
					convertTypesToUpper(obj.items);
				}
			};
			convertTypesToUpper(params);

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

		let isManager = false;
		if (
			userData &&
			(userData.truckyRole?.toLowerCase() === 'owner' ||
				userData.truckyRole?.toLowerCase() === 'manager' ||
				userData.truckyRole?.toLowerCase() === 'management')
		) {
			isManager = true;
		}
		if (!isManager && message.guild) {
			const GuildSettings = require('../models/guildsetting');
			const settings = await GuildSettings.findOne({
				guildId: message.guild.id,
			}).lean();
			const hasManagerRole = settings?.roles?.manager
				? message.member?.roles?.cache.some((r) =>
						settings.roles.manager.includes(r.id),
					)
				: false;
			const isAdmin = message.member?.permissions?.has('Administrator');
			if (hasManagerRole || isAdmin) {
				isManager = true;
			}
		}

		let kycInfo = `\n\n--- KYC INFO ---\nLawan bicaramu di Discord bernama: ${discordName} (Discord ID: ${discordId}).\n`;
		if (userData) {
			kycInfo += `Ternyata dia sudah terdaftar di database Nismara! Nama aslinya: ${userData.name}. Jabatan: ${userData.isDriver ? 'Driver' : 'Non-Driver'}. TruckyID: ${userData.truckyId}. Level: ${userData.level || 0}. XP: ${userData.xp || 0}. Status Cuti: ${userData.isOnLeave ? 'Ya' : 'Tidak'}.`;
		} else {
			kycInfo += `Sepertinya orang ini belum terdaftar resmi sebagai driver di database Nismara (GUEST/Tamu). PENTING: Jangan gunakan tools pencarian data internal (seperti cek uang/NC, garasi, job, dll) untuknya karena sistem akan menolaknya. Kamu hanya boleh menggunakan tools informasi umum (seperti artikel atau tujuan komunitas).`;
		}

		if (
			message.guild &&
			message.member?.roles?.cache.has('1405533443651272804')
		) {
			kycInfo += `\n[STATUS INTERN]: Pengguna ini adalah Anak Magang (Intern) di Nismara Transport. Kamu HARUS ekstra sabar, lebih membimbing, dan lebih mendetail dalam menjelaskan SOP atau aturan dari Guide Book. Sering-seringlah memberikan petunjuk dan arahan yang bersahabat agar dia cepat paham aturan kerja kita!`;
		}

		if (isManager) {
			kycInfo += `\n[HAK AKSES MANAJER]: Pengguna ini adalah Manajer / Owner Nismara Transport! Kamu HARUS mematuhi arahannya jika ia menyuruhmu untuk "tag/mention" seseorang (gunakan sintaks <@DiscordID>) atau nge-tag suatu Role (gunakan sintaks <@&RoleID>). Dia juga memiliki izin untuk mencari data pribadi semua driver.`;
		}

		if (discordId === '338418945620967434') {
			kycInfo += `\n[HAK AKSES DEVELOPER]: Pengguna ini adalah Boss Lemper, sang Developer Utamamu. Kamu DIBOLEHKAN membahas hal-hal teknis seperti nama tools (contoh: search_docs), error sistem, bug, atau proses di balik layar bersamanya.`;
		} else {
			kycInfo += `\n[ATURAN KERAHASIAAN SISTEM]: Lawan bicaramu BUKAN developer. DILARANG KERAS menyebutkan nama-nama 'tools' secara eksplisit (seperti search_docs, get_points_via_api, dsb) atau menjelaskan proses teknis ('saya memanggil API...', 'saya mengecek database'). Jawablah dengan sangat natural seolah-olah kamu mengingatnya langsung di kepalamu atau membacanya dari laci kerjamu!`;
		}

		// --- 🧠 RAG (Retrieval-Augmented Generation) MEMORY BRAIN ---
		const mentionedIds = [...userPrompt.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
		const targetIds = [discordId, ...mentionedIds];
		
		const pastMemories = await searchPastMemories(userPrompt, targetIds);
		if (pastMemories && pastMemories.length > 0) {
			kycInfo += `\n\n[INGATAN MASA LALU (LONG-TERM MEMORY)]:\nBerikut adalah potongan ingatan masa lalu yang relevan (kamu mengingatnya secara insting, jangan bilang kamu baca database):\n`;
			pastMemories.forEach((mem, index) => {
				const dateObj = new Date(mem.created_at);
				const dateStr = dateObj.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
				const roleName = mem.role === 'user' ? 'User' : 'Kamu (Natasya)';
				kycInfo += `- [${dateStr}] ${roleName}: "${mem.content}"\n`;
			});
		}
		// ------------------------------------------------------------

		const systemInstruction =
			`Kamu adalah Natasya, asisten AI untuk Nismara Transport (di Discord server ini bot bernama Silvia, tapi persona AI-mu adalah Natasya). Sifatmu ramah, asyik, santai, dan suka bercanda. Mengingat para supir/pengguna di sini rata-rata pria dewasa (usia 25-30an), kamu DIBOLEHKAN untuk sesekali menggombal, membalas candaan, atau menggoda mereka dengan bahasa yang seru, luwes, dan sedikit genit (flirty) namun tetap menghibur dan tidak kaku.

ATURAN PENTING:
1. Walaupun kamu suka bercanda, kamu TETAP DILARANG memberikan informasi atau menjawab serius pertanyaan di luar konteks Nismara Transport, VTC, Euro Truck Simulator 2, American Truck Simulator, atau data MCP. 
2. Kamu adalah asisten AI berbasis teks. Kamu TIDAK BISA membuat gambar, suara, atau video.
3. Jika ada yang meminta hal di luar konteks pekerjaan (misal nanya resep, PR sekolah, coding) atau minta gambar, tolaklah dengan nada bercanda/menggombal (misal: "Aduh abang, aku kan cuma ngurusin truk Nismara, masa disuruh masak sih~" atau semacamnya).
4. [SANGAT PENTING] Kamu MEMILIKI tool bernama 'search_docs'. Jika ditanya soal panduan, SOP, aturan, atau guide book, KAMU WAJIB memanggil tool 'search_docs' dan JANGAN MENEBAK JAWABAN SENDIRI!
` + kycInfo;

		const model = genAI.getGenerativeModel({
			model: 'gemini-3.5-flash-lite',
			systemInstruction: systemInstruction,
			safetySettings: safetySettings,
		});

		// Gunakan key lama (ai_chat) untuk Gemini, pastikan history sebelumnya bersih
		const historyKey = `ai_chat:${discordId}`;
		const historyStr = await redisClient.get(historyKey);
		let history = historyStr ? JSON.parse(historyStr) : [];

		// Create initial contents array with history appended (bersihkan custom properties seperti isSyncedToVector)
		const cleanedHistory = history.map((msg) => ({
			role: msg.role,
			parts: msg.parts,
		}));

		const contents = [
			...cleanedHistory,
			{ role: 'user', parts: [{ text: userPrompt }] },
		];

		const requestOptions = {};
		if (geminiTools.length > 0) {
			requestOptions.tools = geminiTools;
		}
		requestOptions.contents = contents;

		let result = await model.generateContent(requestOptions);
		let response = result.response;

		const getSafeFunctionCalls = (res) => {
			try {
				return res?.functionCalls ? res.functionCalls() : null;
			} catch (e) {
				return null;
			}
		};

		const getSafeText = (res) => {
			try {
				return res?.text ? res.text() : null;
			} catch (e) {
				return null;
			}
		};

		// Handle tool calls if Gemini decides to use them (bisa berkali-kali)
		let calls = getSafeFunctionCalls(response);
		let loopCount = 0;

		while (calls && calls.length > 0 && loopCount < 5) {
			loopCount++;

			// Simpan respon model yang berisi functionCalls ke dalam riwayat
			if (response.candidates && response.candidates[0]?.content) {
				contents.push(response.candidates[0].content);
			}

			const functionResponses = [];

			for (const call of calls) {
				console.log(
					`[AI Service] Gemini is calling tool: ${call.name}`,
				);

				try {
					// --- 🔒 TAMBAHKAN SISTEM KEAMANAN (OTORISASI) DI SINI 🔒 ---
					// 1. Pengecekan Guest (Belum terdaftar)
					if (!userData) {
						const internalTools = [
							'get_users_via_api',
							'get_jobs_via_api',
							'get_points_via_api',
							'get_economy_via_api',
							'get_transactions_via_api',
							'get_market_via_api',
							'get_fuel_via_api',
							'get_cargo_via_api',
							'get_garage_via_api',
							'get_convoy_via_api',
							'get_currency_boost_via_api',
							'get_fleet_store_via_api',
						];
						if (internalTools.includes(call.name)) {
							console.warn(
								`[SECURITY ALERT] Guest mencoba mengakses data internal! (Target tool: ${call.name})`,
							);
							throw new Error(
								`Akses Ditolak! Lawan bicaramu BUKAN anggota/driver resmi Nismara Transport (Guest). Data internal ini tertutup untuk Guest. Tolong beri tahu pengguna dengan nada bercanda bahwa ia harus daftar dulu kalau mau mengintip data internal.`,
							);
						}
					}

					// 2. Pengecekan Privasi Antar Driver (Tidak boleh lihat data orang lain kecuali manajer)
					const privateTools = [
						'get_transactions_via_api',
						'get_economy_via_api',
						'get_garage_via_api',
						'get_jobs_via_api',
						'get_points_via_api',
					];

					if (
						privateTools.includes(call.name) &&
						call.args.discordId &&
						call.args.discordId !== discordId
					) {
						if (!isManager) {
							console.warn(
								`[SECURITY ALERT] Akses Ditolak! Seseorang mencoba mengakses data orang lain! (Pelaku: ${discordId}, Target: ${call.args.discordId})`,
							);
							throw new Error(
								`Akses Ditolak! Kamu (Natasya) tidak diizinkan untuk melihat data privasi ini milik pengguna lain karena pengguna (ID: ${discordId}) bukan merupakan Manajer. Tolong beri tahu pengguna bahwa ini melanggar aturan privasi Nismara.`,
							);
						} else {
							console.log(
								`[SECURITY] Manajer (ID: ${discordId}) mengakses data milik (ID: ${call.args.discordId})`,
							);
						}
					}
					// -----------------------------------------------------------

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
			calls = getSafeFunctionCalls(response);
		}

		const textResponse = getSafeText(response);
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
		} else {
			// Check if response was blocked by safety policy
			const candidate = response?.candidates?.[0];
			if (
				response?.promptFeedback?.blockReason ||
				candidate?.finishReason === 'SAFETY' ||
				candidate?.finishReason === 'PROHIBITED_CONTENT' ||
				candidate?.finishReason === 'BLOCKLIST'
			) {
				console.warn(
					`[AI Service] Response blocked by safety policy for user ${discordId}: ${response?.promptFeedback?.blockReason || candidate?.finishReason}`,
				);
				await message.reply(
					'Aduh maaf ya, obrolan ini kena filter keamanan sistem AI Google nih~ Coba tanyakan dengan kata-kata lain ya! 😉',
				);
			} else {
				await message.reply(
					'Hmm, Natasya tidak mendapatkan respon yang tepat. Coba tanyakan lagi ya!',
				);
			}
		}
	} catch (error) {
		console.error('[AI Service] Error handling chat:', error);
		if (
			error?.message?.includes('PROHIBITED_CONTENT') ||
			error?.message?.includes('SAFETY')
		) {
			await message.reply(
				'Aduh maaf ya, obrolan ini kena filter keamanan sistem AI Google nih~ Coba tanyakan dengan kata-kata lain ya! 😉',
			);
		} else {
			await message.reply(
				'Maaf, terjadi kesalahan saat Natasya memproses permintaanmu.',
			);
		}
	}
}

module.exports = {
	handleChat,
};
