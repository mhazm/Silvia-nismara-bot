const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DiscordBot = require('../../client/DiscordBot');
const Currency = require('../../models/currency');
const CurrencyHistory = require('../../models/currencyhistory');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'takenc',
		description: 'Kurangi NC dari driver',
		type: 1,
		options: [
			{
				name: 'user',
				type: ApplicationCommandOptionType.User,
				required: true,
				description: 'Driver yang dikurangi NC',
			},
			{
				name: 'jumlah',
				type: ApplicationCommandOptionType.Integer,
				required: true,
				description: 'Jumlah NC yang dikurangi',
			},
			{
				name: 'alasan',
				type: ApplicationCommandOptionType.String,
				required: true,
				description: 'Alasan pengurangan NC',
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

		const guildSettings = await GuildSettings.findOne({ guildId });

		const isManager = guildSettings?.roles?.manager?.some((roleId) =>
			interaction.member.roles.cache.has(roleId),
		);

		if (!isManager)
			return interaction.reply({
				content: '❌ Kamu tidak memiliki izin untuk mengurangi N¢.',
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

		let currency = await Currency.findOne({ guildId, userId: target.id });
		if (!currency) {
			return interaction.reply({
				content: '❌ User ini belum memiliki N¢.',
				ephemeral: true,
			});
		}

		if (currency.totalNC < amount) {
			return interaction.reply({
				content: '❌ N¢ user tidak mencukupi!',
				ephemeral: true,
			});
		}

		currency.totalNC -= amount;
		await currency.save();

		await CurrencyHistory.create({
			guildId,
			userId: target.id,
			amount: -amount,
			managerId: interaction.user.id,
			reason,
			type: 'spend',
		});

		// DM Notification
		try {
			await target.send({
				embeds: [
					new EmbedBuilder()
						.setTitle('💰 NC Kamu Dikurangi!')
						.setDescription(
							`Kamu mendapatkan pengurangan **${amount} N¢**\n` +
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
							.setTitle('🟢 NC Taken')
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
			content: `✅ ${amount} N¢ telah dikurangi dari ${target}`,
			ephemeral: true,
		});
	},
}).toJSON();
