const {
	ChatInputCommandInteraction,
	EmbedBuilder,
	ApplicationCommandOptionType,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');

const ApplicationCommand = require('../../structure/ApplicationCommand');
const DiscordBot = require('../../client/DiscordBot');
const Currency = require('../../models/currency');
const CurrencyHistory = require('../../models/currencyhistory');
const GuildSettings = require('../../models/guildsetting');

module.exports = new ApplicationCommand({
	command: {
		name: 'wallet',
		description: 'Lihat saldo dan riwayat Nismara Coin',
		type: 1,
		options: [
			{
				name: 'user',
				description: 'Siapa yang ingin dicek (khusus manager)',
				type: ApplicationCommandOptionType.User,
				required: false,
			},
		],
	},
	options: {
		cooldown: 5000,
	},
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		const guildId = interaction.guild.id;
		const target = interaction.options.getUser('user') || interaction.user;

		const guildSettings = await GuildSettings.findOne({ guildId });

		const isManager = guildSettings?.roles?.manager?.some((roleId) =>
			interaction.member.roles.cache.has(roleId),
		);

		// user biasa tidak bisa cek orang lain
		if (target.id !== interaction.user.id && !isManager) {
			return interaction.reply({
				content:
					'❌ Kamu tidak memiliki izin untuk melihat wallet orang lain.',
				ephemeral: true,
			});
		}

		await interaction.deferReply();

		// Ambil currency
		let currency = await Currency.findOne({ guildId, userId: target.id });
		if (!currency) {
			currency = await Currency.create({
				guildId,
				userId: target.id,
				totalNC: 0,
			});
		}

		// Ambil history
		const history = await CurrencyHistory.find({
			guildId,
			userId: target.id,
		})
			.sort({ createdAt: -1 })
			.lean();

		// Pagination
		const pageSize = 10;
		let page = 0;
		const totalPages = Math.max(1, Math.ceil(history.length / pageSize));

		const getPageEmbed = () => {
			const start = page * pageSize;
			const pageData = history.slice(start, start + pageSize);

			const embed = new EmbedBuilder()
				.setTitle(`💼 Wallet — ${target.username}`)
				.setColor('Blue')
				.addFields({
					name: '💳 Total Balance',
					value: `**${currency.totalNC} N¢**`,
					inline: false,
				})
				.setFooter({ text: `Page ${page + 1} / ${totalPages}` })
                .setThumbnail(target.displayAvatarURL({ forceStatic: false }))
				.setTimestamp();

			if (pageData.length > 0) {
				embed.addFields({
					name: '📜 Riwayat Transaksi',
					value: pageData
						.map(
							(t) =>
								`• **${t.amount > 0 ? '🟢 +' : '🔴 -'}${Math.abs(t.amount)} N¢** — ${t.reason} \n <t:${Math.floor(
									t.createdAt.getTime() / 1000,
								)}:f>`,
						)
						.join('\n'),
				});
			} else {
				embed.addFields({
					name: '📜 Riwayat Transaksi',
					value: '_Tidak ada history yang ditemukan._',
				});
			}

			return embed;
		};

		const prevBtn = new ButtonBuilder()
			.setCustomId('prev_page')
			.setLabel('⬅ Prev')
			.setStyle(ButtonStyle.Secondary);

		const nextBtn = new ButtonBuilder()
			.setCustomId('next_page')
			.setLabel('Next ➡')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

		const msg = await interaction.editReply({
			embeds: [getPageEmbed()],
			components: [row],
		});

		const collector = msg.createMessageComponentCollector({
			time: 120000,
		});

		collector.on('collect', async (btn) => {
			if (btn.user.id !== interaction.user.id)
				return btn.reply({
					content: '❌ Ini bukan tombol kamu.',
					ephemeral: true,
				});

			if (btn.customId === 'prev_page') {
				page = page > 0 ? page - 1 : totalPages - 1;
			} else {
				page = page + 1 < totalPages ? page + 1 : 0;
			}

			await btn.update({
				embeds: [getPageEmbed()],
				components: [row],
			});
		});

		collector.on('end', async () => {
			row.components.forEach((c) => c.setDisabled(true));
			msg.edit({ components: [row] }).catch(() => {});
		});
	},
}).toJSON();
