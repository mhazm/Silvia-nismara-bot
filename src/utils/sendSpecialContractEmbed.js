const {
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
} = require('discord.js');
const Contract = require('../models/contract');

module.exports = async function sendSpecialContractEmbed({
	client,
	guild,
    message,
	userId,
	job,
	active,
	earnedNC,
}) {
	try {

        if (!message.guild) return;
        const guildId = message.guild.id;

		const contract = await Contract.findOne({ guildId });
		const notifyChannel = contract?.channelId
			? await guild.channels
					.fetch(contract.channelId)
					.catch(() => null)
			: null;

		// 🔹 PAGE 1 — Ringkasan Job
		const page1 = new EmbedBuilder()
			.setTitle(`📦 Special Contract Completed! - #${active.jobId}`)
			.setColor('Green')
			.setAuthor({
				name: job.driver.name,
				iconURL: job.driver.avatar_url,
			})
			.addFields(
				{ name: '👤 Driver', value: `<@${userId}>`, inline: true },
				{
					name: '🏢 Asal',
					value: job.source_company_name,
					inline: true,
				},
				{
					name: '🏭 Tujuan',
					value: job.destination_company_name,
					inline: true,
				},
				{
					name: '🚚 Rute',
					value: `${job.source_city_name} → ${job.destination_city_name} (${job.real_driven_distance_km} km)`,
				},
				{
					name: '📦 Kargo',
					value: `${job.cargo_name} (${job.cargo_mass_t}t)`,
					inline: true,
				},
				{ name: '⏱️ Durasi', value: job.duration, inline: true },
				{
					name: '💰 Nismara Coin Didapat',
					value: `${earnedNC} N¢`,
					inline: true,
				},
			)
			.setThumbnail(job.driver.avatar_url)
			.setURL(job.public_url)
			.setTimestamp()
			.setFooter({ text: 'Halaman 1 • Ringkasan Job' });

		// 💰 PAGE 2 — Statistik Ekonomi (versi tabel)
		const page2 = new EmbedBuilder()
			.setTitle('💰 Laporan Keuangan & Statistik Ekonomi')
			.setColor('Gold');

		// 🔧 Fungsi format offence agar lebih rapi dan natural
		function formatOffenceName(offence) {
			if (!offence || typeof offence !== 'string')
				return 'Tidak diketahui';

			// Mapping manual untuk offence umum + emoji
			const map = {
				red_signal: 'Melanggar lampu merah 🚦',
				no_lights: 'Lampu tidak dinyalakan 💡',
				speeding: 'Melampaui batas kecepatan 🏎️',
				parking: 'Parkir tidak benar 🅿️',
				overload: 'Kelebihan muatan ⚖️',
				overtaking: 'Menyalip sembarangan 🚗💨',
				fatigue: 'Mengemudi dalam keadaan lelah 😴',
				crash: 'Kecelakaan lalu lintas 💥',
				late_delivery: 'Pengiriman terlambat ⏰',
				toll_violation: 'Pelanggaran tol 🚧',
				police_fine: 'Ditilang polisi 👮',
			};

			// Jika ada di mapping → tampilkan yang sudah diformat
			if (map[offence]) return map[offence];

			// fallback otomatis: ganti _ dengan spasi dan kapitalisasi kata
			return offence
				.split('_')
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(' ');
		}

		// pastikan job.fines_details adalah string JSON
		let finesArr = [];
		if (
			job.fines_details &&
			typeof job.fines_details === 'string' &&
			job.fines_details.length > 2
		) {
			try {
				finesArr = JSON.parse(job.fines_details);
			} catch (err) {
				console.error('Gagal parse fines_details:', err);
				finesArr = [];
			}
		}

		// hitung total fines dari data atau gunakan job.fines_total bila ada
		const finesTotalFromList =
			Array.isArray(finesArr) && finesArr.length > 0
				? finesArr.reduce((s, f) => s + (f.amount || 0), 0)
				: 0;

		// ambil biaya lain, damage, dsb
		const otherCosts = Number(job.other_costs_total || 0);
		const damageCost = Number(job.damage_cost || 0);
		const taxes = Number(job.taxes || 0);
		const rentCost = Number(job.rent_cost_total || 0);

		// hitung net profit sederhana (contoh)
		const netProfit =
			Number(job.income || 0) -
			(taxes + rentCost + otherCosts + damageCost + finesTotalFromList);

		// --- build economyReport satu code block (lebih rapi) ---
		let economyReport = [];
		economyReport.push(
			`🏦 Pendapatan Kotor  : ${Number(job.income || 0).toLocaleString()} T¢`,
		);
		economyReport.push(
			`💵 Pendapatan Bersih : ${Number(job.revenue || 0).toLocaleString()} T¢`,
		);
		economyReport.push(
			`💸 Pajak             : ${taxes.toLocaleString()} T¢`,
		);
		economyReport.push(
			`🧾 Biaya Sewa        : ${rentCost.toLocaleString()} T¢`,
		);
		economyReport.push(
			`⛽ Bahan Bakar       : ${Number(job.fuel_used_l || 0).toFixed(1)} L (${Number(job.fuel_cost || 0).toFixed(2)} T¢)`,
		);
		economyReport.push(
			`⚙️ Efisiensi BBM     : ${job.fuel_economy_l100km ?? '-'} L/100km`,
		);

		// section lain (only if exists)
		if (otherCosts > 0) {
			economyReport.push('');
			economyReport.push(
				`💼 Biaya Lain-lain   : ${otherCosts.toFixed(2)} T¢`,
			);
		}

		if (damageCost > 0) {
			let damageDetails = {};
			try {
				damageDetails = JSON.parse(job.damage_cost_details || '{}');
			} catch (e) {
				damageDetails = {};
			}
			economyReport.push('');
			economyReport.push(
				`💥 Biaya Kerusakan   : ${damageCost.toFixed(2)} T¢`,
			);
			economyReport.push(
				`  🚛 Truk    : ${damageDetails.vehicle_damage ?? 0}T¢`,
			);
			economyReport.push(
				`  🛞 Trailer : ${damageDetails.trailers_damage ?? 0}T¢`,
			);
			economyReport.push(
				`  📦 Kargo   : ${damageDetails.cargo_damage ?? 0}T¢`,
			);
		}

		// fines (only if exists)
		if (Array.isArray(finesArr) && finesArr.length > 0) {
			economyReport.push('');
			economyReport.push('🚨 Denda :');

			const showLimit = 8;
			finesArr.slice(0, showLimit).forEach((f) => {
				const label = formatOffenceName(f.offence);
				economyReport.push(
					`• ${label} — ${Number(f.amount || 0).toLocaleString()} T¢`,
				);
			});

			if (finesArr.length > showLimit) {
				economyReport.push(
					`(+${finesArr.length - showLimit} denda lainnya)`,
				);
			}
		}

		// ringkasan akhir
		economyReport.push('');
		economyReport.push(
			`🧾 Net Profit (est)  : ${netProfit.toLocaleString()} T¢`,
		);

		// set embed description sebagai satu code block (monospace, rapi)
		page2
			.setDescription('```yaml\n' + economyReport.join('\n') + '\n```')
			.setTimestamp()
			.setFooter({
				text: 'Halaman 2 • Laporan Keuangan & Statistik Ekonomi',
			});

		// ⚙️ PAGE 3 — Damage & Performa
		const page3 = new EmbedBuilder()
			.setTitle('⚙️ Damage & Performa Kendaraan')
			.setColor('Red')
			.addFields(
				{
					name: '🚛 Kerusakan Truk',
					value: `${job.vehicle_damage}%`,
					inline: true,
				},
				{
					name: '🛞 Kerusakan Trailer',
					value: `${job.trailers_damage}%`,
					inline: true,
				},
				{
					name: '📦 Kerusakan Kargo',
					value: `${job.cargo_damage}%`,
					inline: true,
				},
				{
					name: '🚀 Kecepatan Maksimum',
					value: `${job.max_speed_kmh} km/h`,
					inline: true,
				},
				{
					name: '🧭 Kecepatan Rata-rata',
					value: `${job.average_speed_kmh} km/h`,
					inline: true,
				},
				{
					name: '⭐ Rating Pengiriman',
					value: `${job.delivery_rating_details?.rating ?? 0}`,
					inline: true,
				},
			)
			.setTimestamp()
			.setFooter({ text: 'Halaman 3 • Damage & Performa' });

		// === 🔍 Cek apakah data Realistic Points tersedia ===
		let pages = [page1, page2, page3];
		let options = [
			{
				label: '📄 Ringkasan Job',
				value: '0',
				description: 'Lihat ringkasan umum job',
			},
			{
				label: '💰 Statistik Ekonomi',
				value: '1',
				description: 'Pendapatan, pajak, dan bahan bakar',
			},
			{
				label: '⚙️ Damage & Performa',
				value: '2',
				description: 'Kerusakan kendaraan dan rating',
			},
		];

		// hanya tambahkan page4 kalau ada data realistis
		if (job.realistic_points_calculation || job.realistic_ldb_points) {
			const rp = job.realistic_points_calculation || {};
			const page4 = new EmbedBuilder()
				.setTitle('🎯 Realistic Points & Driver Rating')
				.setColor('Blue')
				.addFields(
					{
						name: '🏁 Total Poin',
						value: `${job.realistic_ldb_points ?? 0}`,
						inline: true,
					},
					{
						name: '⭐ Rating Realistis',
						value: `${job.delivery_rating_details?.rating ?? 0}`,
						inline: true,
					},
					{
						name: '📏 Jarak',
						value: `${rp.distance?.toFixed(1) ?? 0}`,
						inline: true,
					},
					{
						name: '⚖️ Berat Muatan',
						value: `${rp.mass?.toFixed(1) ?? 0}`,
						inline: true,
					},
					{
						name: '🚫 Denda',
						value: `${rp.fines?.toFixed(1) ?? 0}`,
						inline: true,
					},
					{
						name: '💥 Kerusakan',
						value: `${rp.damage?.toFixed(1) ?? 0}`,
						inline: true,
					},
					{
						name: '⛽ Efisiensi BBM',
						value: `${rp.fuel_economy?.toFixed(1) ?? 0}`,
						inline: true,
					},
					{
						name: '🅿️ Parkir Ganda',
						value: `${rp.hard_parking_doubles?.toFixed(1) ?? 0}`,
						inline: true,
					},
				)
				.setTimestamp()
				.setFooter({ text: 'Halaman 4 • Realistic Points' });

			pages.push(page4);
			options.push({
				label: '🎯 Realistic Points',
				value: '3',
				description: 'Poin realistis dan performa driver',
			});
		}

		// 🔹 Buat Select Menu
		const menu = new StringSelectMenuBuilder()
			.setCustomId('page_select')
			.setPlaceholder('📑 Pilih halaman untuk dilihat')
			.addOptions(options);

		const row = new ActionRowBuilder().addComponents(menu);

		// 🔹 Kirim embed navigasi ke channel kontrak
		if (!notifyChannel) {
			return interaction.editReply(
				'❌ Channel kontrak tidak ditemukan atau belum diatur.',
			);
		}

		let currentPage = 0;
		const message = await notifyChannel.send({
			content: `✅ **${job.driver.name}** telah menyelesaikan Special Contract!`,
			embeds: [pages[currentPage]],
			components: [row],
		});

		// Role yang boleh lihat data
		const allowedRoles = [
			'1077368181926141973',
			'1405532668472590437',
			'1333622587749564619',
		]; // Manager, Moderator, dsb

		// 🔹 Collector aktif sampai 1 hari (24 jam = 86400000 ms)
		const collector = message.createMessageComponentCollector({
			time: 36000000,
		});

		collector.on('collect', async (i) => {
			const member = await i.guild.members.fetch(i.user.id);
			const hasRole = member.roles.cache.some((role) =>
				allowedRoles.includes(role.id),
			);
			const isDriver = i.user.id === userId;

			if (!isDriver && !hasRole) {
				return i.reply({
					content:
						'❌ Kamu tidak memiliki izin untuk melihat data job ini.',
					ephemeral: true,
				});
			}

			const selected = parseInt(i.values[0]);
			currentPage = selected;

			await i.update({
				embeds: [pages[currentPage]],
				components: [row],
			});
		});

		collector.on('end', async () => {
			menu.setDisabled(true);
			await message.edit({
				components: [new ActionRowBuilder().addComponents(menu)],
			});
		});
	} catch (error) {
		console.error('❌ Gagal mengirim embed special contract:', error);
	}
};