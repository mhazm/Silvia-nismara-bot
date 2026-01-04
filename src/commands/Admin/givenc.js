const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DiscordBot = require('../../client/DiscordBot');
const Currency = require('../../models/currency');
const CurrencyHistory = require('../../models/currencyHistory');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'givenc',
		description: 'Berikan NC kepada driver',
		type: 1,
		options: [
			{
				name: 'user',
				type: ApplicationCommandOptionType.User,
				description: 'Driver yang diberikan NC',
				required: true,
			},
			{
				name: 'jumlah',
				type: ApplicationCommandOptionType.Integer,
				description: 'Jumlah NC',
				required: true,
			},
			{
				name: 'alasan',
				type: ApplicationCommandOptionType.String,
				description: 'Alasan pemberian NC',
				required: true,
			},
		],
	},

	options: {
		allowedRoles: ['manager'],
		cooldown: 5000,
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		const guildId = interaction.guild.id;
		const target = interaction.options.getUser('user');
		const amount = interaction.options.getInteger('jumlah');
		const reason = interaction.options.getString('alasan');

		if (amount <= 0) {
			return interaction.reply({
				content: '❌ Jumlah NC harus lebih dari 0!',
				ephemeral: true,
			});
		}

		const guildSettings = await GuildSettings.findOne({ guildId });

		const isManager = guildSettings?.roles?.manager?.some((roleId) =>
			interaction.member.roles.cache.has(roleId),
		);

		if (!isManager)
			return interaction.reply({
				content: '❌ Kamu tidak memiliki izin untuk memberikan N¢.',
				ephemeral: true,
			});

		// 🔑 Gabungkan role Sopir + Magang
		const driverRoles = [
			...(guildSettings.roles?.driver || []),
			...(guildSettings.roles?.magang || []),
		];

		if (!driverRoles.length) {
			return interaction.editReply(
				'⚠️ Role driver / magang belum diset di guild settings.',
			);
		}

		const member = await interaction.guild.members.fetch(target.id);

		// ✅ Validasi: punya salah satu role
		const isDriver = member.roles.cache.some((r) =>
			driverRoles.includes(r.id),
		);

		if (!isDriver) {
			return interaction.editReply(
				'❌ User ini **bukan driver atau magang** sehingga tidak dapat diberi poin.',
			);
		}

		// Update currency
		let currency = await Currency.findOne({ guildId, userId: target.id });
		if (!currency) {
			currency = await Currency.create({
				guildId,
				userId: target.id,
				totalNC: 0,
			});
		}

		currency.totalNC += amount;
		await currency.save();

		// Save history
		await CurrencyHistory.create({
			guildId,
			userId: target.id,
			amount,
			managerId: interaction.user.id,
			reason,
			type: 'earn',
		});

		// DM Notification
		try {
			await target.send({
				embeds: [
					new EmbedBuilder()
						.setTitle('💰 Kamu Mendapatkan NC!')
						.setDescription(
							`Kamu mendapatkan **${amount} N¢**\n` +
								`📌 Alasan: **${reason}**\n\n` +
								`💳 Total NC sekarang: **${currency.totalNC} N¢**`,
						)
						.setColor('Green'),
				],
			});
		} catch {}

		// Log channel
		if (guildSettings.channelLog) {
			const logCh = interaction.guild.channels.cache.get(
				guildSettings.channelLog,
			);
			if (logCh) {
				logCh.send({
					embeds: [
						new EmbedBuilder()
							.setTitle('🟢 NC Given')
							.addFields(
								{
									name: 'Manager',
									value: interaction.user.toString(),
									inline: true,
								},
								{
									name: 'Driver',
									value: target.toString(),
									inline: true,
								},
								{
									name: 'Amount',
									value: `${amount} NC`,
									inline: true,
								},
								{ name: 'Reason', value: reason },
							)
							.setColor('Green'),
					],
				});
			}
		}

		interaction.reply({
			content: `✅ Berhasil memberikan **${amount} N¢** kepada ${target}`,
			ephemeral: true,
		});
	},
}).toJSON();
