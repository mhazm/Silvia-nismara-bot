const { ChatInputCommandInteraction, EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Contract = require('../../models/contract');

module.exports = new ApplicationCommand({
	command: {
		name: 'contractstatus',
		description: 'Check status kontrak aktif',
		type: 1,
		options: [
			{
				name: 'game',
				description: 'Pilih game untuk kontrak ini. 1 = ETS2, 2 = ATS',
				choices: [
					{ name: 'Euro Truck Simulator 2', value: 1 },
					{ name: 'American Truck Simulator', value: 2 },
				],
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
		],
	},
	options: {
		allowedRoles: ['driver'],
		cooldown: 10000,
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		const guildId = interaction.guild.id;
		const gameId = interaction.options.getInteger('game');
		const contract = await Contract.findOne({ guildId, gameId });

		if (!contract) {
			return interaction.editReply(
				'⚠️ Belum ada kontrak aktif saat ini.',
			);
		}

		// 🔹 Hitung durasi berjalan
		const startedAtUnix = Math.floor(contract.setAt.getTime() / 1000);

		const runningDays = Math.ceil(
			(Date.now() - contract.setAt) / (1000 * 60 * 60 * 24),
		);

		// Contract Contributors
		let topContributorsText = 'Belum ada kontribusi.';
		let participantCount = 0;

		if (contract.contributors && contract.contributors.length > 0) {
			participantCount = contract.contributors.length;

			topContributorsText = contract.contributors
				.sort((a, b) => b.totalNC - a.totalNC)
				.slice(0, 3)
				.map((c, index) => {
					const medal =
						index === 0
							? '🥇'
							: index === 1
								? '🥈'
								: index === 2
									? '🥉'
									: '•';
									
					return `${medal} <@${c.driverId}> — ${c.jobs} job | ${c.totalNC.toLocaleString()} N¢`;
				})
				.join('\n');
		}

		// 🔹 Embed
		const embed = new EmbedBuilder()
			.setTitle('📦 Status Kontrak Aktif')
			.setColor('#00AEEF')
			.addFields(
				{
					name: '🏢 Perusahaan',
					value: contract.companyName,
				},
				{
					name: '🗓️ Mulai Kontrak',
					value: `<t:${startedAtUnix}:f>\n(<t:${startedAtUnix}:R>)`,
				},
				{
					name: '📅 Berakhir Pada',
					value: contract.endAt ? `<t:${Math.floor(contract.endAt.getTime() / 1000)}:f>\n(<t:${Math.floor(contract.endAt.getTime() / 1000)}:R>)` : 'N/A',
				},
				{
					name: '⏳ Durasi Berjalan',
					value: `${runningDays} hari`,
					inline: true,
				},
				{
					name: '👤 Ditetapkan Oleh',
					value: contract.setBy ? `<@${contract.setBy}>` : 'N/A',
					inline: true,
				},
				{
					name: '👥 Jumlah Kontributor',
					value: `${participantCount} orang`,
					inline: true,
				},
				{
					name: '🏆 Top Kontributor',
					value: topContributorsText,
				},
			)
			.setTimestamp();

		if (contract.imageUrl) {
			embed.setImage(contract.imageUrl);
		}

		return interaction.editReply({ embeds: [embed] });
	},
}).toJSON();
