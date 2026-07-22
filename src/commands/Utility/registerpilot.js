const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const ApplicationCommand = require('../../structure/ApplicationCommand');
const DiscordBot = require('../../client/DiscordBot');
const PilotRegistry = require('../../models/pilotdata.js');
const GuildSettings = require('../../models/guildsetting.js');

function normalize(str) {
	return str.trim().toLowerCase();
}

/**
 * Ambil semua member Fshub (handle pagination)
 */
async function fetchAllMembers() {
	let page = 1;
	let lastPage = 1;
	const allMembers = [];

	do {
		const res = await fetch(
			`https://fshub.io/api/v3/airline/6445/pilot?page=${page}`,
			{
				headers: {
					'X-Pilot-Token': process.env.FSHUB_API_KEY,
					Accept: 'application/json',
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
				},
			},
		);

		const json = await res.json();

		if (!json?.data || !Array.isArray(json.data)) {
			throw new Error('Invalid FSHub API response');
		}

		allMembers.push(...json.data);
		lastPage = json.last_page;
		page++;
	} while (page <= lastPage);

	return allMembers;
}

module.exports = new ApplicationCommand({
	command: {
		name: 'registerpilot',
		description: 'Mendaftarkan pilot ke database nismara',
		type: 1,
		options: [
			{
				name: 'user',
				description: 'User Discord yang ingin didaftarkan',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
			{
				name: 'pilotid',
				description: 'ID Pilot sesuai di Fshub',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	options: {
		allowedRoles: ['manager'],
		cooldown: 10000,
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const guildId = interaction.guild.id;
			const managerId = interaction.user.id;

			// Ambil role manager dari database
			const settings = await GuildSettings.findOne({ guildId });
			if (!settings || !settings.roles.manager?.length) {
				return interaction.editReply(
					'⚠️ Role manager belum diset di guild settings.',
				);
			}

			const member = interaction.guild.members.cache.get(managerId);
			const isManager = member.roles.cache.some((r) =>
				settings.roles.manager.includes(r.id),
			);

			if (!isManager) {
				return interaction.editReply(
					'❌ Kamu tidak memiliki izin untuk mendaftarkan pilot.',
				);
			}

			const targetUser = interaction.options.getUser('user');
			const pilotIdInput = interaction.options.getString('pilotid');

			// Cek apakah user sudah terdaftar
			const exists = await PilotRegistry.findOne({
				guildId,
				userId: targetUser.id,
			});
			if (exists) {
				return interaction.editReply(
					'⚠️ User ini sudah terdaftar sebagai pilot.',
				);
			}

			// Fetch semua pilot dari Fshub (SEMUA PAGE)
			const members = await fetchAllMembers();

			// Matching id Fshub
			const pilotIdClean = pilotIdInput.trim();
			const pilot = members.find((m) => String(m.id) === pilotIdClean);

			if (!pilot) {
				return interaction.editReply(
					`❌ ID **${pilotIdInput}** tidak ditemukan di Fshub Members.`,
				);
			}

			// Simpan ke database
			await PilotRegistry.create({
				guildId,
				userId: targetUser.id,
				pilotName: pilot.name,
				pilotId: pilot.id,
			});

			const embed = new EmbedBuilder()
				.setTitle('✅ Pilot Berhasil Didaftarkan')
				.setColor('Green')
				.setThumbnail(targetUser.displayAvatarURL())
				.addFields(
					{
						name: 'Discord User',
						value: `<@${targetUser.id}>`,
						inline: true,
					},
					{ name: 'Pilot Name', value: pilot.name, inline: true },
					{
						name: 'Pilot ID',
						value: String(pilot.id),
						inline: true,
					},
				)
				.setTimestamp();

			return interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error('❌ Error Register Pilot:', err);
			return interaction.editReply(
				`⚠️ Terjadi kesalahan saat memproses permintaan.\n ${err}`,
			);
		}
	},
}).toJSON();
