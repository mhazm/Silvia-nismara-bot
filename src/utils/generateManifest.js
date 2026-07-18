const PDFDocument = require('pdfkit');
const path = require('path');

// 🔴 PERHATIKAN: Ada tambahan parameter ke-8 yaitu `penaltyDetails`
async function buildJobInvoice(
	job,
	reward,
	cost,
	rewardTotal,
	totalCurrency,
	driverName,
	companyLogoUrl,
	penaltyDetails, // Data pinalti dari main file
) {
	return new Promise(async (resolve, reject) => {
		const doc = new PDFDocument({ size: 'A4', margin: 0 });
		let buffers = [];

		const fontRegular = path.join(
			__dirname,
			'../assets/fonts/GoogleSans-Regular.ttf',
		);
		const fontBold = path.join(
			__dirname,
			'../assets/fonts/GoogleSans-Bold.ttf',
		);
		const fontSignature = path.join(
			__dirname,
			'../assets/fonts/amsterdam-handwriting.regular.ttf',
		);

		doc.registerFont('GoogleSans', fontRegular);
		doc.registerFont('GoogleSans-Bold', fontBold);
		doc.registerFont('Handwriting', fontSignature);

		doc.on('data', buffers.push.bind(buffers));
		doc.on('end', () => {
			resolve(Buffer.concat(buffers));
		});

		const bgWhite = '#ffffff';
		const boxBg = '#f8fafc';
		const borderLine = '#cbd5e1';
		const textBlack = '#0f172a';
		const textGray = '#475569';
		const accentColor = '#3730a3';
		const successGreen = '#16a34a';
		const failRed = '#dc2626';

		doc.rect(0, 0, doc.page.width, doc.page.height).fill(bgWhite);

		const formatTime = (seconds) => {
			if (!seconds) return 'N/A';
			const h = Math.floor(seconds / 3600);
			const m = Math.floor((seconds % 3600) / 60);
			const s = seconds % 60;
			return `${h}h ${m}m ${s}s`;
		};

		const mapGameName = (gameId) => {
			if (gameId === '1') return 'Euro Truck Simulator 2';
			if (gameId === '2') return 'American Truck Simulator';
			return 'Unknown Game';
		};

		const marginX = 40;
		let startY = 40;

		// ==========================================================
		//  🖼️ FETCH LOGO DARI URL
		// ==========================================================
		let logoBuffer = null;
		if (companyLogoUrl) {
			try {
				const response = await fetch(companyLogoUrl);
				if (response.ok) {
					const arrayBuffer = await response.arrayBuffer();
					logoBuffer = Buffer.from(arrayBuffer);
				}
			} catch (error) {
				console.error('Gagal mengambil logo company dari URL:', error);
			}
		}

		// ==========================================================
		//  1️⃣ HEADER & BRANDING (PAGE 1)
		// ==========================================================
		let textOffsetX = marginX;
		if (logoBuffer) {
			doc.image(logoBuffer, marginX, startY - 5, {
				width: 50,
				height: 50,
			});
			textOffsetX = marginX + 65;
		}

		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(24)
			.text('NISMARA TRANSPORT', textOffsetX, startY);
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(10)
			.text('More Than Just a Transport', textOffsetX, startY + 28);
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(8)
			.text(
				`Registration No. TRUCKY-35643 | ${mapGameName(job.game_id)}`,
				textOffsetX,
				startY + 45,
			);

		const isLate = job.late_delivery === true;
		const statusText = isLate ? 'LATE DELIVERY' : 'ON-TIME';
		const statusColor = isLate ? failRed : successGreen;
		const statusBg = isLate ? '#fef2f2' : '#f0fdf4';

		doc.fillColor(statusBg)
			.strokeColor(statusColor)
			.lineWidth(1.5)
			.roundedRect(doc.page.width - 130, startY, 90, 22, 4)
			.fillAndStroke();
		doc.fillColor(statusColor)
			.font('GoogleSans-Bold')
			.fontSize(10)
			.text(statusText, doc.page.width - 130, startY + 6, {
				width: 90,
				align: 'center',
			});
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(7)
			.text('DELIVERY STATUS', doc.page.width - 130, startY + 28, {
				width: 90,
				align: 'center',
			});
		doc.lineWidth(1);

		startY += 75; // SPASI DIPERKETAT

		// ==========================================================
		//  2️⃣ QUICK PERFORMANCE STATS
		// ==========================================================
		const boxWidth = (doc.page.width - marginX * 2) / 4;
		doc.fillColor(boxBg)
			.strokeColor(borderLine)
			.rect(marginX, startY, doc.page.width - marginX * 2, 55)
			.fillAndStroke();

		for (let i = 1; i < 4; i++) {
			doc.moveTo(marginX + boxWidth * i, startY)
				.lineTo(marginX + boxWidth * i, startY + 55)
				.strokeColor(borderLine)
				.stroke();
		}

		const penaltyPoints = penaltyDetails?.total || 0;
		const stats = [
			{
				label: 'TOTAL DAMAGE',
				val: `${job.vehicle_damage || 0}%`,
				color: textBlack,
			},
			{
				label: 'DISTANCE',
				val: `${job.driven_distance_km || 0} km`,
				color: textBlack,
			},
			{
				label: 'RATING',
				val: `${job.delivery_rating_details?.rating || 'N/A'} / 5`,
				color: textBlack,
			},
			{
				label: 'PENALTY',
				val: `${penaltyPoints} pts`,
				color: penaltyPoints > 0 ? failRed : successGreen,
			},
		];

		stats.forEach((stat, i) => {
			doc.fillColor(stat.color)
				.font('GoogleSans-Bold')
				.fontSize(13)
				.text(stat.val, marginX + boxWidth * i, startY + 12, {
					width: boxWidth,
					align: 'center',
				});
			doc.fillColor(textGray)
				.font('GoogleSans-Bold')
				.fontSize(7)
				.text(stat.label, marginX + boxWidth * i, startY + 32, {
					width: boxWidth,
					align: 'center',
				});
		});

		startY += 75;

		// ==========================================================
		//  3️⃣ DRIVER & VEHICLE INFO
		// ==========================================================
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('1. DRIVER INFORMATION', 40, startY);
		doc.text('2. VEHICLE SPECIFICATION', 305, startY);

		doc.fillColor(boxBg)
			.strokeColor(borderLine)
			.rect(40, startY + 15, 250, 55)
			.fillAndStroke();
		doc.fillColor(boxBg)
			.strokeColor(borderLine)
			.rect(305, startY + 15, 250, 55)
			.fillAndStroke();

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('DRIVER NAME', 55, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(11)
			.text(driverName, 55, startY + 38);

		const brand =
			job.vehicle_brand_name ||
			job.vehicle?.model?.brand?.name ||
			'Rental Truck';
		const model =
			job.vehicle_model_name || job.vehicle?.vehicle_name || 'Quick Job';
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('VEHICLE MODEL', 320, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(11)
			.text(`${brand} - ${model}`, 320, startY + 38);
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(8)
			.text(
				`Fleet Number: ${job.vehicle?.fleet_number || 'Rental Truck'}`,
				320,
				startY + 53,
			);

		startY += 85;

		// ==========================================================
		//  4️⃣ SOURCE & DESTINATION
		// ==========================================================
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('3. SOURCE AND DESTINATION', 40, startY);
		doc.fillColor(bgWhite)
			.strokeColor(borderLine)
			.rect(40, startY + 15, 515, 65)
			.stroke();
		doc.moveTo(297.5, startY + 15)
			.lineTo(297.5, startY + 80)
			.strokeColor(borderLine)
			.stroke();

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('SHIPPER (FROM)', 55, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(12)
			.text(job.source_company_name || 'N/A', 55, startY + 40);
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(10)
			.text(job.source_city_name || 'N/A', 55, startY + 56);

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('CONSIGNEE (TO)', 312, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(12)
			.text(job.destination_company_name || 'N/A', 312, startY + 40);
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(10)
			.text(job.destination_city_name || 'N/A', 312, startY + 56);

		startY += 95;

		// ==========================================================
		//  5️⃣ CARGO & MISSION DESCRIPTION
		// ==========================================================
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('4. CARGO & MISSION DESCRIPTION', 40, startY);
		doc.fillColor(bgWhite)
			.strokeColor(borderLine)
			.rect(40, startY + 15, 515, 110)
			.stroke();

		doc.moveTo(40, startY + 51)
			.lineTo(555, startY + 51)
			.strokeColor(borderLine)
			.stroke();
		doc.moveTo(40, startY + 87)
			.lineTo(555, startY + 87)
			.strokeColor(borderLine)
			.stroke();
		doc.moveTo(211, startY + 15)
			.lineTo(211, startY + 125)
			.strokeColor(borderLine)
			.stroke();
		doc.moveTo(383, startY + 15)
			.lineTo(383, startY + 125)
			.strokeColor(borderLine)
			.stroke();

		const gridY1 = startY + 23;
		const gridY2 = startY + 60;
		const gridY3 = startY + 95;

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('CARGO NAME', 55, gridY1);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(10)
			.text(job.cargo_name || 'N/A', 55, gridY1 + 12);
		doc.fillColor(textBlack)
			.font('GoogleSans')
			.fontSize(7)
			.text('WEIGHT', 226, gridY1);
		doc.fillColor(textBlack)
			.font('GoogleSans')
			.fontSize(10)
			.text(`${job.cargo_mass_t || 0} Tons`, 226, gridY1 + 12);
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('DRIVEN DISTANCE', 398, gridY1);
		doc.fillColor(textBlack)
			.font('GoogleSans')
			.fontSize(10)
			.text(`${job.real_driven_distance_km || 0} Km`, 398, gridY1 + 12);

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('DRIVING TIME', 55, gridY2);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(10)
			.text(
				job.duration || formatTime(job.real_driving_time_seconds),
				55,
				gridY2 + 12,
			);

		const deliveryDate = job.completed_at
			? new Date(job.completed_at).toLocaleDateString('id-ID')
			: new Date().toLocaleDateString('id-ID');
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('DELIVERY DATE', 226, gridY2);
		doc.fillColor(textBlack)
			.font('GoogleSans')
			.fontSize(10)
			.text(deliveryDate, 226, gridY2 + 12);

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('CONTRACT NUMBER', 398, gridY2);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(10)
			.text(`#${job.id}`, 398, gridY2 + 12);

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('FUEL USED', 55, gridY3);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(10)
			.text(
				`${job.fuel_used_l ? job.fuel_used_l.toFixed(1) : 0} L`,
				55,
				gridY3 + 12,
			);
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('FUEL EFFICIENCY', 226, gridY3);
		doc.fillColor(textBlack)
			.font('GoogleSans')
			.fontSize(10)
			.text(
				`${job.fuel_economy_l100km || '-'} L/100km`,
				226,
				gridY3 + 12,
			);
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('MAX SPEED', 398, gridY3);
		doc.fillColor(textBlack)
			.font('GoogleSans')
			.fontSize(10)
			.text(`${job.max_speed_kmh || 0} km/h`, 398, gridY3 + 12);

		startY += 140;

		// ==========================================================
		//  6️⃣ FINANCIAL & NC REPORTS
		// ==========================================================
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('5. FINANCIAL & NC REPORTS', 40, startY);

		doc.fillColor(bgWhite)
			.strokeColor(borderLine)
			.rect(40, startY + 15, 515, 125)
			.stroke();
		doc.moveTo(297.5, startY + 15)
			.lineTo(297.5, startY + 105)
			.strokeColor(borderLine)
			.stroke();

		doc.fillColor(successGreen)
			.font('GoogleSans-Bold')
			.fontSize(8)
			.text('EARNINGS (+)', 55, startY + 25);
		let incY = startY + 40;
		doc.fillColor(textBlack).font('GoogleSans').fontSize(9);

		doc.text(`Base Reward`, 55, incY);
		doc.text(`${reward.base} N¢`, 225, incY, { width: 55, align: 'right' });
		incY += 15;
		if (reward.special > 0) {
			doc.text(`Special Contract`, 55, incY);
			doc.text(`${reward.special} N¢`, 225, incY, {
				width: 55,
				align: 'right',
			});
			incY += 15;
		}
		if (reward.hardcore > 0) {
			doc.text(`Hardcore Bonus`, 55, incY);
			doc.text(`${reward.hardcore} N¢`, 225, incY, {
				width: 55,
				align: 'right',
			});
			incY += 15;
		}
		if (reward.event > 0) {
			doc.text(`Event Boost`, 55, incY);
			doc.text(`${reward.event} N¢`, 225, incY, {
				width: 55,
				align: 'right',
			});
		}

		doc.fillColor(failRed)
			.font('GoogleSans-Bold')
			.fontSize(8)
			.text('DEDUCTIONS (-)', 312, startY + 25);
		let expY = startY + 40;
		doc.fillColor(textBlack).font('GoogleSans').fontSize(9);

		if (cost.rent > 0) {
			doc.text(`Vehicle Rental`, 312, expY);
			doc.text(`-${cost.rent} N¢`, 480, expY, {
				width: 55,
				align: 'right',
			});
			expY += 15;
		}
		if (cost.service > 0) {
			doc.text(`Service & Damage`, 312, expY);
			doc.text(`-${cost.service} N¢`, 480, expY, {
				width: 55,
				align: 'right',
			});
			expY += 15;
		}
		if (cost.fuel > 0) {
			doc.text(`Fuel Cost`, 312, expY);
			doc.text(`-${cost.fuel} N¢`, 480, expY, {
				width: 55,
				align: 'right',
			});
		}

		const netColor = rewardTotal >= 0 ? '#f0fdf4' : '#fef2f2';
		const netText = rewardTotal >= 0 ? successGreen : failRed;

		doc.fillColor(netColor)
			.strokeColor(borderLine)
			.rect(40, startY + 105, 515, 35)
			.fillAndStroke();
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(11)
			.text('NET PROFIT (FINAL NC)', 55, startY + 117);
		doc.fillColor(netText).text(`${rewardTotal} N¢`, 390, startY + 117, {
			width: 150,
			align: 'right',
		});

		startY += 165;

		// ==========================================================
		//  7️⃣ FOOTER & SIGNATURE (Aman di Page 1)
		// ==========================================================
		doc.moveTo(40, startY + 30)
			.lineTo(180, startY + 30)
			.strokeColor(borderLine)
			.stroke();

		doc.fillColor(textBlack)
			.font('Handwriting')
			.fontSize(21)
			.text(driverName, 40, startY - 20, { width: 140, align: 'center' });
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('DIGITAL SIGNATURE', 40, startY + 35, {
				width: 140,
				align: 'center',
			});

		doc.strokeColor(textBlack)
			.lineWidth(2)
			.rect(410, startY - 10, 130, 35)
			.stroke();
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(16)
			.text('DELIVERED', 410, startY, { width: 130, align: 'center' });
		doc.lineWidth(1);

		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(8)
			.text(
				`Total Current Balance: ${totalCurrency} N¢`,
				40,
				startY + 65,
				{ width: 515, align: 'center' },
			);

		// ==========================================================
		//  📄 HALAMAN 2: LAPORAN KERUSAKAN & PINALTI
		// ==========================================================
		doc.addPage();

		// Background putih untuk halaman 2
		doc.rect(0, 0, doc.page.width, doc.page.height).fill(bgWhite);
		let p2Y = 40;

		// Header Page 2
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(18)
			.text('SUPPLEMENTARY REPORT', marginX, p2Y);
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(9)
			.text(`Job Reference: #${job.id || 'N/A'}`, marginX, p2Y + 22);

		p2Y += 60;

		// --- 6. INCIDENT & DAMAGE BREAKDOWN ---
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('6. INCIDENT & DAMAGE BREAKDOWN', 40, p2Y);
		doc.fillColor(boxBg)
			.strokeColor(borderLine)
			.rect(40, p2Y + 15, 515, 75)
			.fillAndStroke();

		// Garis pemisah 3 kolom
		const colW = 515 / 3;
		doc.moveTo(40 + colW, p2Y + 15)
			.lineTo(40 + colW, p2Y + 90)
			.strokeColor(borderLine)
			.stroke();
		doc.moveTo(40 + colW * 2, p2Y + 15)
			.lineTo(40 + colW * 2, p2Y + 90)
			.strokeColor(borderLine)
			.stroke();

		const dmgs = [
			{ title: 'VEHICLE DAMAGE', val: job.vehicle_damage || 0 },
			{ title: 'TRAILER DAMAGE', val: job.trailers_damage || 0 },
			{ title: 'CARGO DAMAGE', val: job.cargo_damage || 0 },
		];

		dmgs.forEach((dmg, i) => {
			const xPos = 40 + colW * i;
			const color = dmg.val > 0 ? failRed : successGreen;

			doc.fillColor(textGray)
				.font('GoogleSans-Bold')
				.fontSize(8)
				.text(dmg.title, xPos, p2Y + 30, {
					width: colW,
					align: 'center',
				});
			doc.fillColor(color)
				.font('GoogleSans-Bold')
				.fontSize(16)
				.text(`${dmg.val}%`, xPos, p2Y + 45, {
					width: colW,
					align: 'center',
				});
		});

		p2Y += 115;

		// --- 7. PENALTY POINTS DETAILS ---
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('7. PENALTY POINTS BREAKDOWN', 40, p2Y);

		if (!penaltyDetails || penaltyDetails.total === 0) {
			// Tidak ada pinalti
			doc.fillColor('#f0fdf4')
				.strokeColor(successGreen)
				.rect(40, p2Y + 15, 515, 50)
				.fillAndStroke();
			doc.fillColor(successGreen)
				.font('GoogleSans-Bold')
				.fontSize(11)
				.text(
					'Excellent Driving! No penalties recorded for this job.',
					40,
					p2Y + 32,
					{ width: 515, align: 'center' },
				);
		} else {
			// Ada pinalti, rincikan!
			doc.fillColor('#fef2f2')
				.strokeColor(failRed)
				.rect(40, p2Y + 15, 515, 140)
				.fillAndStroke();
			let penY = p2Y + 30;

			doc.fillColor(textBlack)
				.font('GoogleSans-Bold')
				.fontSize(10)
				.text('Violations Detected:', 60, penY);
			penY += 20;

			doc.font('GoogleSans').fontSize(9);
			const rules = [
				{
					name: 'Vehicle Damage Limit Exceeded',
					pts: penaltyDetails.vehicle,
				},
				{
					name: 'Trailer Damage Limit Exceeded',
					pts: penaltyDetails.trailer,
				},
				{
					name: 'Cargo Damage Limit Exceeded',
					pts: penaltyDetails.cargo,
				},
				{
					name: 'Speeding Violation (Race Miles)',
					pts: penaltyDetails.speed,
				},
				{
					name: 'Minimum Distance Violation',
					pts: penaltyDetails.distance,
				},
			];

			rules.forEach((rule) => {
				if (rule.pts > 0) {
					doc.fillColor(failRed).text(`• ${rule.name}`, 65, penY);
					doc.text(`+${rule.pts} pts`, 450, penY, {
						width: 80,
						align: 'right',
					});
					penY += 15;
				}
			});

			doc.moveTo(60, penY + 5)
				.lineTo(530, penY + 5)
				.strokeColor('#fca5a5')
				.stroke();

			doc.fillColor(failRed)
				.font('GoogleSans-Bold')
				.fontSize(11)
				.text('TOTAL PENALTY POINTS', 60, penY + 15);
			doc.text(`${penaltyDetails.total} pts`, 450, penY + 15, {
				width: 80,
				align: 'right',
			});
		}

		doc.end();
	});
}

module.exports = { buildJobInvoice };
