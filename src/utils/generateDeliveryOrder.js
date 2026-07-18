const PDFDocument = require('pdfkit');
const path = require('path');

async function buildDeliveryOrder(job, driverName, companyLogoUrl) {
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
		const accentColor = '#3730a3'; // Indigo Nismara
		const dispatchColor = '#eab308'; // Kuning/Gold untuk status DISPATCHED

		doc.rect(0, 0, doc.page.width, doc.page.height).fill(bgWhite);

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
		//  1️⃣ HEADER & BRANDING (DELIVERY ORDER)
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
			.text(
				'OFFICIAL DELIVERY ORDER / SURAT JALAN',
				textOffsetX,
				startY + 28,
			);
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(8)
			.text('Registration No. TRUCKY-35643', textOffsetX, startY + 45);

		// Status Badge: DISPATCHED
		doc.fillColor('#fefce8')
			.strokeColor(dispatchColor)
			.lineWidth(1.5)
			.roundedRect(doc.page.width - 130, startY, 90, 22, 4)
			.fillAndStroke();
		doc.fillColor(dispatchColor)
			.font('GoogleSans-Bold')
			.fontSize(10)
			.text('DISPATCHED', doc.page.width - 130, startY + 6, {
				width: 90,
				align: 'center',
			});
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(7)
			.text('DOCUMENT STATUS', doc.page.width - 130, startY + 28, {
				width: 90,
				align: 'center',
			});
		doc.lineWidth(1);

		startY += 80;

		// ==========================================================
		//  2️⃣ DOKUMEN INFO (Nomor Referensi & Tanggal)
		// ==========================================================
		doc.fillColor(boxBg)
			.strokeColor(borderLine)
			.rect(marginX, startY, doc.page.width - marginX * 2, 45)
			.fillAndStroke();

		doc.moveTo(doc.page.width / 2, startY)
			.lineTo(doc.page.width / 2, startY + 45)
			.strokeColor(borderLine)
			.stroke();

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('DELIVERY ORDER NO.', marginX + 15, startY + 10);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(12)
			.text(`DO-${job.id}`, marginX + 15, startY + 22);

		const startDate = new Date(job.created_at).toLocaleString('id-ID', {
			dateStyle: 'full',
			timeStyle: 'short',
			timeZone: 'Asia/Jakarta',
		});
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('DISPATCH DATE & TIME', doc.page.width / 2 + 15, startY + 10);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(11)
			.text(`${startDate} WIB`, doc.page.width / 2 + 15, startY + 22);

		startY += 70;

		// ==========================================================
		//  3️⃣ DRIVER & VEHICLE INFO
		// ==========================================================
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('1. AUTHORIZED DRIVER & VEHICLE', 40, startY);

		doc.fillColor(bgWhite)
			.strokeColor(borderLine)
			.rect(40, startY + 15, 515, 55)
			.stroke();
		doc.moveTo(297.5, startY + 15)
			.lineTo(297.5, startY + 70)
			.strokeColor(borderLine)
			.stroke();

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
			.text('ASSIGNED VEHICLE', 312, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(11)
			.text(`${brand} - ${model}`, 312, startY + 38);

		startY += 95;

		// ==========================================================
		//  4️⃣ ROUTING PLAN (SOURCE & DEST)
		// ==========================================================
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('2. ROUTING DIRECTIVE', 40, startY);
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
			.text('PICKUP LOCATION (FROM)', 55, startY + 25);
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
			.text('DELIVERY DESTINATION (TO)', 312, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(12)
			.text(job.destination_company_name || 'N/A', 312, startY + 40);
		doc.fillColor(textGray)
			.font('GoogleSans')
			.fontSize(10)
			.text(job.destination_city_name || 'N/A', 312, startY + 56);

		startY += 105;

		// ==========================================================
		//  5️⃣ CARGO DETAILS
		// ==========================================================
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('3. CARGO MANIFEST', 40, startY);
		doc.fillColor(bgWhite)
			.strokeColor(borderLine)
			.rect(40, startY + 15, 515, 60)
			.stroke();

		doc.moveTo(211, startY + 15)
			.lineTo(211, startY + 75)
			.strokeColor(borderLine)
			.stroke();
		doc.moveTo(383, startY + 15)
			.lineTo(383, startY + 75)
			.strokeColor(borderLine)
			.stroke();

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('CARGO DESCRIPTION', 55, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(11)
			.text(job.cargo_name || 'N/A', 55, startY + 40);

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('GROSS WEIGHT', 226, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans')
			.fontSize(11)
			.text(`${job.cargo_mass_t || 0} Tons`, 226, startY + 40);

		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('PLANNED DISTANCE', 398, startY + 25);
		doc.fillColor(textBlack)
			.font('GoogleSans')
			.fontSize(11)
			.text(`${job.planned_distance_km || 0} Km`, 398, startY + 40);

		startY += 100;

		// ==========================================================
		//  6️⃣ DISPATCH INSTRUCTIONS & RULES
		// ==========================================================
		doc.fillColor(accentColor)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text('4. DISPATCH INSTRUCTIONS & SAFETY PROTOCOLS', 40, startY);
		doc.fillColor(boxBg)
			.strokeColor(borderLine)
			.rect(40, startY + 15, 515, 110)
			.fillAndStroke();

		let ruleY = startY + 30;
		doc.fillColor(textBlack)
			.font('GoogleSans-Bold')
			.fontSize(9)
			.text(
				'Dengan menerima Surat Jalan ini, Pengemudi diwajibkan untuk mematuhi aturan berikut:',
				55,
				ruleY,
			);

		doc.font('GoogleSans').fontSize(9);
		ruleY += 20;
		const rules = [
			'1. Mematuhi batas kecepatan dan rambu lalu lintas yang berlaku di setiap rute negara.',
			'2. Menjaga kondisi kargo dan kendaraan agar terhindar dari kerusakan (Target Damage: 0%).',
			'3. Mengutamakan keselamatan berkendara (Safety First) selama beroperasi di bawah Nismara.',
			'4. Segala bentuk denda lalu lintas atau biaya kerusakan akan dipotong dari hasil pendapatan job ini.',
		];

		rules.forEach((rule) => {
			doc.text(rule, 55, ruleY, { width: 480 });
			ruleY += 15;
		});

		startY += 170;

		// ==========================================================
		//  7️⃣ SIGNATURE AUTHORIZATION
		// ==========================================================
		// Garis tanda tangan Dispatcher (Kiri)
		doc.moveTo(40, startY + 50)
			.lineTo(180, startY + 50)
			.strokeColor(borderLine)
			.stroke();
		doc.fillColor(textBlack)
			.font('Handwriting')
			.fontSize(26)
			.text('Natasya', 40, startY - 20, {
				width: 140,
				align: 'center',
			});
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('AUTHORIZED DISPATCHER', 40, startY + 55, {
				width: 140,
				align: 'center',
			});

		// Garis tanda tangan Supir (Kanan)
		doc.moveTo(415, startY + 50)
			.lineTo(555, startY + 50)
			.strokeColor(borderLine)
			.stroke();
		// Karena supir baru mulai, kita pasang namanya dengan font handwriting seolah dia sudah "Tanda Tangan" ambil job
		doc.fillColor(textBlack)
			.font('Handwriting')
			.fontSize(26)
			.text(driverName, 415, startY - 20, {
				width: 140,
				align: 'center',
			});
		doc.fillColor(textGray)
			.font('GoogleSans-Bold')
			.fontSize(7)
			.text('DRIVER ACKNOWLEDGEMENT', 415, startY + 55, {
				width: 140,
				align: 'center',
			});

		doc.end();
	});
}

module.exports = { buildDeliveryOrder };
