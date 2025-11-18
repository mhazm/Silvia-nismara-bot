const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	AttachmentBuilder,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Point = require('../../models/points');
const PointHistory = require('../../models/pointhistory');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'removepoint',
		description: 'Tambahkan poin ke pengguna',
		type: 1,
		options: [
			{
				name: 'driver',
				description: 'Pilih driver yang akan ditambahkan poin',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
			{
				name: 'jumlah',
				description: 'Jumlah poin yang akan ditambahkan',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				name: 'alasan',
				description: 'Alasan penambahan poin',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	options: {
		allowedRoles: ['manager'], // Hanya user dengan role ini yang bisa menjalankan command
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		const guildId = interaction.guild.id;
		const managerId = interaction.user.id;
		const driver = interaction.options.getUser('driver');
		const jumlah = interaction.options.getInteger('jumlah');
		const alasan = interaction.options.getString('alasan');

		if (driver.bot)
			return interaction.editReply(
				'❌ Kamu tidak bisa mengurangi poin bot.',
			);

		// 🔹 Ambil pengaturan guild
		const settings = await GuildSettings.findOne({ guildId });
		if (!settings) {
			return interaction.editReply(
				'⚠️ Guild belum memiliki konfigurasi settings.',
			);
		}

		const driverRoles = settings.roles?.driver || [];
		const logChannelId = settings.channelLog;

		// 🔹 Ambil guild member
		const member = await interaction.guild.members.fetch(driver.id);

		// ❗ VALIDASI: apakah dia punya role driver?
		const isDriver = member.roles.cache.some((r) =>
			driverRoles.includes(r.id),
		);
		if (!isDriver) {
			return interaction.editReply(
				'❌ User ini **bukan driver** sehingga tidak dapat diberi poin.',
			);
		}

		let pointData = await Point.findOne({ guildId, userId: driver.id });
		if (!pointData)
			return interaction.editReply(
				'❌ Driver ini belum memiliki data poin.',
			);

		pointData.totalPoints -= jumlah;
		if (pointData.totalPoints < 0) pointData.totalPoints = 0;
		await pointData.save();

		await PointHistory.create({
			guildId,
			userId: driver.id,
			managerId,
			points: jumlah,
			reason: alasan,
			type: 'remove',
		});

		const embed = new EmbedBuilder()
			.setTitle('🎯 Poin Dikurangi')
			.setColor('Green')
			.addFields(
				{ name: 'Driver', value: `<@${driver.id}>`, inline: true },
				{ name: 'Jumlah', value: `-${jumlah}`, inline: true },
				{ name: 'Alasan', value: alasan },
			)
			.setFooter({ text: `Dikurangi oleh ${interaction.user.username}` })
			.setTimestamp();

		await interaction.editReply({ embeds: [embed] });

		// 🔹 Logging ke channel log
		if (logChannelId) {
			const logChannel =
				interaction.guild.channels.cache.get(logChannelId);
			if (logChannel) {
				const logEmbed = new EmbedBuilder()
					.setTitle('📝 Remove Point Log')
					.setColor('Blue')
					.addFields(
						{
							name: 'Manager',
							value: `<@${managerId}>`,
							inline: true,
						},
						{
							name: 'Driver',
							value: `<@${driver.id}>`,
							inline: true,
						},
						{ name: 'Poin', value: `-${jumlah}`, inline: true },
						{ name: 'Alasan', value: alasan },
					)
					.setTimestamp();

				logChannel.send({ embeds: [logEmbed] }).catch(() => {});
			}
		}

		const dmEmbed = new EmbedBuilder()
			.setTitle('🎉 Poin Kamu Dikurangi')
			.setColor('Green')
			.setDescription(
				`Point kamu telah dikurangi **${jumlah} poin** di server **${interaction.guild.name}**.`,
			)
			.addFields(
				{ name: '📝 Alasan', value: alasan },
				{
					name: '📊 Total Poin Sekarang',
					value: `${pointData.totalPoints}`,
				},
			)
			.setTimestamp()
			.setFooter({ text: 'Terus pertahankan performamu, driver!' });

		try {
			await driver.send({ embeds: [dmEmbed] });
		} catch (err) {
			console.warn(`Tidak bisa kirim DM ke ${driver.tag} (DM tertutup).`);
		}
	},
}).toJSON();
