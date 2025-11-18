const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const ApplicationCommand = require('../../structure/ApplicationCommand');
const DiscordBot = require('../../client/DiscordBot');
const DriverRegistry = require('../../models/driverlink.js');
const GuildSettings = require('../../models/guildsetting.js');

function normalize(str) {
	return str.trim().toLowerCase();
}

module.exports = new ApplicationCommand({
	command: {
		name: 'registerdriver',
		description: 'Mendaftarkan driver ke sistem validasi job',
		type: 1,
		options: [
			{
				name: 'user',
				description: 'User Discord yang ingin didaftarkan',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
			{
				name: 'truckyname',
				description: 'Nama driver sesuai di Trucky',
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
					'❌ Kamu tidak memiliki izin untuk mendaftarkan driver.',
				);
			}

			const targetUser = interaction.options.getUser('user');
			const truckyNameInput = normalize(
				interaction.options.getString('truckyname'),
			);

			// Cek apakah user sudah terdaftar
			const exists = await DriverRegistry.findOne({
				guildId,
				userId: targetUser.id,
			});
			if (exists) {
				return interaction.editReply(
					'⚠️ User ini sudah terdaftar sebagai driver.',
				);
			}

			// Fetch data driver dari Trucky
			const res = await fetch(
				`https://e.truckyapp.com/api/v1/company/35643/members`,
				{
					headers: {
						'x-access-token': process.env.TRUCKY_API_KEY,
						Accept: 'application/json',
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
						Referer: 'https://nismara.web.id/',
						Origin: 'https://nismara.web.id',
					},
				},
			);
			const json = await res.json();

			const members = json?.data;
			if (!members || !Array.isArray(members)) {
				return interaction.editReply('❌ Gagal memuat data Trucky.');
			}

			// Matching nama Trucky (fix full match, startswith, includes)
			const driver =
				members.find((m) => normalize(m.name) === truckyNameInput) ||
				members.find((m) =>
					normalize(m.name).startsWith(truckyNameInput),
				) ||
				members.find((m) =>
					normalize(m.name).includes(truckyNameInput),
				);

			if (!driver) {
				return interaction.editReply(
					`❌ Nama **${truckyNameInput}** tidak ditemukan di Trucky Members.`,
				);
			}

			// Simpan ke database
			await DriverRegistry.create({
				guildId,
				userId: targetUser.id,
				truckyName: driver.name,
				truckyId: driver.id,
			});

			const embed = new EmbedBuilder()
				.setTitle('✅ Driver Berhasil Didaftarkan')
				.setColor('Green')
				.addFields(
					{
						name: 'Discord User',
						value: `<@${targetUser.id}>`,
						inline: true,
					},
					{ name: 'Trucky Name', value: driver.name, inline: true },
					{
						name: 'Trucky ID',
						value: String(driver.id),
						inline: true,
					},
				)
				.setTimestamp();

			return interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error('❌ Error registerdriver:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat memproses permintaan.',
			);
		}
	},
}).toJSON();
