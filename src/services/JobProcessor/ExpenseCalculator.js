const Fleet =
	require('../../models/fleet').default || require('../../models/fleet');
const FleetStore = require('../../models/fleetStore');
const Garage = require('../../models/Garage');
const FuelPrice = require('../../models/FuelPrice');
const FuelUsageHistory = require('../../models/FuelUsageHistory');
const InsuranceClaimHistory = require('../../models/insuranceClaimHistory');
const { EmbedBuilder } = require('discord.js');

// 🔧 Fungsi format offence agar lebih rapi dan natural
function formatOffenceName(offence) {
	if (!offence || typeof offence !== 'string') return 'Tidak diketahui';

	const map = {
		red_signal: 'Melanggar lampu merah',
		no_lights: 'Lampu tidak dinyalakan',
		speeding: 'Melampaui batas kecepatan',
		parking: 'Parkir tidak benar',
		overload: 'Kelebihan muatan',
		overtaking: 'Menyalip sembarangan',
		fatigue: 'Mengemudi dalam keadaan lelah',
		crash: 'Kecelakaan lalu lintas',
		late_delivery: 'Pengiriman terlambat',
		toll_violation: 'Pelanggaran tol',
		police_fine: 'Ditilang polisi',
		wrong_way: 'Salah lanjur jalan',
	};

	if (map[offence]) return map[offence];

	return offence
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

/**
 * Calculates expenses (rent, fuel, service, fines) and updates related fleet/garage data.
 */
async function calculateExpenses(context, client) {
	const { job, userData, discordId, guildId, truckyId, jobId, settings } =
		context;
	const km = Number(job.driven_distance_km || 0);
	const now = new Date();

	// 1. SERVICE COST (Damage)
	const serviceDetails = job.damage_cost_details
		? JSON.parse(job.damage_cost_details)
		: {};
	const cargoDamageCost = Math.round(serviceDetails?.cargo_damage / 2) || 0;
	const vehicleDamageCost =
		Math.round(serviceDetails?.vehicle_damage / 2) || 0;
	const trailerDamageCost =
		Math.round(serviceDetails?.trailers_damage / 2) || 0;
	context.cost.service = Math.round(
		cargoDamageCost + vehicleDamageCost + trailerDamageCost,
	);
	console.log(
		`💰 Service Cost: ${context.cost.service} N¢ (Cargo: ${cargoDamageCost}, Vehicle: ${vehicleDamageCost}, Trailer: ${trailerDamageCost})`,
	);

	// 2. DISCOUNTS
	if (
		userData &&
		userData.nismaraplus?.status &&
		userData.nismaraplus.expiredAt > now
	) {
		context.discount.nismaraplus = Math.round(context.cost.service * 0.3);
	}
	if (
		userData &&
		userData.insurance?.status &&
		userData.insurance.expiredAt > now
	) {
		context.discount.insurance = Math.round(context.cost.service * 0.3);
	}
	context.discount.total = Math.round(
		context.discount.nismaraplus + context.discount.insurance,
	);

	if (context.discount.insurance > 0) {
		const insuranceClaimHistory = new InsuranceClaimHistory({
			guildId,
			discordId,
			truckyId,
			jobId,
			realCost: context.cost.service,
			claimAmount: Math.round(context.discount.insurance),
			claimReason: 'Insurance Damage Cost',
		});
		await insuranceClaimHistory.save();
	}

	// 3. VEHICLE / FLEET RENT COST
	let usedFleet = null;
	if (userData) {
		const vehicleInGameId =
			job.vehicle_in_game_id || job.vehicle?.model?.in_game_id;
		const userFleets = await Fleet.find({ driver: userData._id }).populate(
			'model',
		);

		// 1. Prioritaskan mencari armada yang statusnya 'active'
		usedFleet = userFleets.find(
			(f) =>
				f.model &&
				f.model.in_game_id === vehicleInGameId &&
				f.status === 'active',
		);

		// 2. Jika tidak ada yang active, ambil armada mana saja yang cocok (berarti sedang rusak / diservis)
		if (!usedFleet) {
			usedFleet = userFleets.find(
				(f) => f.model && f.model.in_game_id === vehicleInGameId,
			);
		}

		// 3. Mod Vehicle Fallback
		if (!usedFleet) {
			const isKnownVehicle = await FleetStore.findOne({
				in_game_id: vehicleInGameId,
			});
			if (!isKnownVehicle) {
				const genericId =
					job.game_id === 2
						? 'vehicle.generic.mod.ats'
						: 'vehicle.generic.mod.ets2';
				usedFleet = userFleets.find(
					(f) =>
						f.model &&
						f.model.in_game_id === genericId &&
						f.status === 'active',
				);
				if (!usedFleet) {
					usedFleet = userFleets.find(
						(f) => f.model && f.model.in_game_id === genericId,
					);
				}
			}
		}

		if (usedFleet) {
			if (['need_maintenance', 'onservice'].includes(usedFleet.status)) {
				context.isFleetMaintenancePenalty = true;
				context.rentPricePerKm = 0.5;
				context.cost.rent = Math.round(km * context.rentPricePerKm);
			} else if (usedFleet.status === 'active') {
				usedFleet.odometer += km;
				usedFleet.wear.unfix_engine = Math.min(
					100,
					usedFleet.wear.unfix_engine + (km / 500) * 0.1,
				);
				usedFleet.wear.unfix_tires = Math.min(
					100,
					usedFleet.wear.unfix_tires + (km / 200) * 0.1,
				);
				usedFleet.wear.unfix_transmission = Math.min(
					100,
					usedFleet.wear.unfix_transmission + (km / 800) * 0.1,
				);
				usedFleet.wear.unfix_brakes = Math.min(
					100,
					usedFleet.wear.unfix_brakes + (km / 300) * 0.1,
				);

				const engineDiff =
					usedFleet.odometer - usedFleet.last_maintenance.engine;
				const tiresDiff =
					usedFleet.odometer - usedFleet.last_maintenance.tires;
				const transDiff =
					usedFleet.odometer -
					usedFleet.last_maintenance.transmission;
				const brakesDiff =
					usedFleet.odometer - usedFleet.last_maintenance.brakes;

				if (
					engineDiff >= usedFleet.maintenance.engine ||
					tiresDiff >= usedFleet.maintenance.tires ||
					transDiff >= usedFleet.maintenance.transmission ||
					brakesDiff >= usedFleet.maintenance.brakes
				) {
					usedFleet.status = 'need_maintenance';
				}
				await usedFleet.save();
			}
		} else if (!job.vehicle) {
			// Quick Job / Rental
			context.rentPricePerKm = 0.3;
			context.cost.rent = Math.round(km * context.rentPricePerKm);
		} else {
			// Company Vehicle
			context.rentPricePerKm = 0.2;
			context.cost.rent = Math.round(km * context.rentPricePerKm);
		}
	} else if (!job.vehicle) {
		context.rentPricePerKm = 0.3;
		context.cost.rent = Math.round(km * context.rentPricePerKm);
	}

	if (usedFleet) {
		context.vehicleStatus = 'Owned';
		context.fleetDataObj = {
			fleet_id: usedFleet._id,
			fleet_number: usedFleet.fleet_number,
			fleet_name: usedFleet.model?.name || usedFleet.fleet_name,
			in_game_id: usedFleet.model?.in_game_id,
		};
	} else if (job.vehicle) {
		context.vehicleStatus = 'Company';
	} else {
		context.vehicleStatus = 'Rental';
	}

	// 4. FUEL COST
	if (job.fuel_used_l > 0) {
		const latestFuelPriceData = await FuelPrice.findOne().sort({
			timestamp: -1,
		});
		const fuelPrice = latestFuelPriceData
			? latestFuelPriceData.price
			: settings.fuelPrice || 0.4;
		context.marketFuelPricePerL = fuelPrice;

		let fuelFromGarage = 0;
		let fuelBoughtFromMarket = 0;
		let fuelRemainingNeeded = Math.round(job.fuel_used_l);

		const userGarage = await Garage.findOne({ discordId });
		if (userGarage && userGarage.fuelStock > 0) {
			fuelFromGarage = Math.min(
				fuelRemainingNeeded,
				userGarage.fuelStock,
			);
			userGarage.fuelStock -= fuelFromGarage;
			await userGarage.save();
			fuelRemainingNeeded -= fuelFromGarage;

			try {
				await new FuelUsageHistory({
					discordId,
					jobId: job.id || null,
					source: job.source_city_name || 'Unknown',
					destination: job.destination_city_name || 'Unknown',
					fuelConsumed: fuelFromGarage,
				}).save();
			} catch (historyErr) {
				console.error(
					`[Fuel History] Gagal menyimpan history untuk ${discordId}`,
					historyErr,
				);
			}
		}

		fuelBoughtFromMarket = fuelRemainingNeeded;
		context.cost.fuel = Math.round(fuelBoughtFromMarket * fuelPrice);
		console.log(
			`💰 Fuel Cost: ${context.cost.fuel} N¢ (Used from Garage: ${fuelFromGarage} L, Bought: ${fuelBoughtFromMarket} L, Price: ${fuelPrice})`,
		);

		// Send Fuel Notification DM
		try {
			const fuelEmbed = new EmbedBuilder()
				.setTitle(`⛽ Laporan Konsumsi Bahan Bakar`)
				.setDescription(
					`Job: **${job.source_city_name || 'Unknown'} ➔ ${job.destination_city_name || 'Unknown'}**`,
				)
				.setColor('#F1C40F')
				.addFields({
					name: 'Total Konsumsi',
					value: `${Math.round(job.fuel_used_l)} L`,
					inline: true,
				});

			if (fuelFromGarage > 0) {
				fuelEmbed.addFields({
					name: '✅ Diambil dari Garasi',
					value: `${Math.round(fuelFromGarage)} L\n*(Sisa stok tangki Anda: **${Math.round(userGarage.fuelStock)} L**)*`,
					inline: false,
				});
			}

			if (fuelBoughtFromMarket > 0) {
				let marketDesc = `Membeli sisa bahan bakar: **${Math.round(fuelBoughtFromMarket)} L**\nHarga Market: **${fuelPrice.toFixed(2)} N¢/L**\nTotal Biaya: **${context.cost.fuel} N¢**`;
				if (fuelFromGarage > 0) {
					marketDesc =
						`⚠️ *Stok garasi tidak mencukupi!*\n` + marketDesc;
				}
				fuelEmbed.addFields({
					name: '💵 Pembelian dari Market',
					value: marketDesc,
					inline: false,
				});
			}

			const userToDM = await client.users
				.fetch(discordId)
				.catch(() => null);
			if (userToDM) {
				await userToDM.send({ embeds: [fuelEmbed] });
			}
		} catch (err) {
			console.error(
				`[Fuel Notification] Gagal mengirim DM ke ${discordId}`,
				err,
			);
		}
	}

	// 5. FINES COST
	let finesSummary = {};
	if (job.fines_details) {
		try {
			const parsedFines = JSON.parse(job.fines_details);
			parsedFines.forEach((fine) => {
				if (!finesSummary[fine.offence]) {
					finesSummary[fine.offence] = 0;
				}
				const adjustedAmount = Math.round(fine.amount / 2);
				finesSummary[fine.offence] += adjustedAmount;
				context.cost.fines += adjustedAmount;
			});

			for (const offence in finesSummary) {
				context.finesEvents.push({
					offenceName: formatOffenceName(offence),
					amount: finesSummary[offence],
				});
			}
		} catch (err) {
			console.error('Gagal membaca fines_details:', err);
		}
	}

	// 6. TOTAL COST
	context.cost.total = Math.round(
		context.cost.rent +
			context.cost.service +
			context.cost.fuel +
			context.cost.fines -
			context.discount.total,
	);

	return context;
}

module.exports = { calculateExpenses, formatOffenceName };
