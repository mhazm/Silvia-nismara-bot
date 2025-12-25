const {
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	EmbedBuilder,
} = require('discord.js');

const DiscordBot = require('../../client/DiscordBot.js');
const ApplicationCommand = require('../../structure/ApplicationCommand.js');
const GuildSettings = require('../../models/guildsetting.js');

module.exports = new ApplicationCommand({
	command: {
		name: 'sethargapoin',
		description: 'Mengatur harga penukaran 1 penalty point (NC)',
		type: 1,
		options: [
			{
				name: 'harga',
				description: 'Harga 1 penalty point (dalam NC)',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
		],
	},
	options: {
		botDevelopers: true,
		allowedRoles: ['manager'],
		cooldown: 10000, // 10 detik
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		try {
			const guildId = interaction.guild.id;
			const harga = interaction.options.getInteger('harga');

			// =========================
			// VALIDASI
			// =========================
			if (harga <= 0) {
				return interaction.reply({
					content: '❌ Harga poin harus lebih dari 0.',
					ephemeral: true,
				});
			}

			if (harga < 100) {
				return interaction.reply({
					content:
						'❌ Harga poin terlalu kecil. Minimal 100 NC.',
					ephemeral: true,
				});
			}

			// =========================
			// UPDATE SETTINGS
			// =========================
			const settings = await GuildSettings.findOneAndUpdate(
				{ guildId },
				{ $set: { pointPrice: harga } },
				{ upsert: true, new: true },
			);

			// =========================
			// RESPONSE ADMIN
			// =========================
			await interaction.reply({
				content: `✅ Harga penalty point berhasil diatur menjadi **${harga} N¢ / point**.`,
			});

			// =========================
			// LOG KE CHANNEL
			// =========================
			if (settings.channelLog) {
				const logChannel =
					interaction.guild.channels.cache.get(
						settings.channelLog,
					);

				if (logChannel) {
					const embed = new EmbedBuilder()
						.setTitle('⚙️ Pengaturan Harga Penalty Point')
						.setColor('Gold')
						.addFields(
							{
								name: 'Harga Baru',
								value: `${harga} N¢ / point`,
								inline: true,
							},
							{
								name: 'Diatur Oleh',
								value: `<@${interaction.user.id}>`,
								inline: true,
							},
						)
						.setTimestamp();

					logChannel.send({ embeds: [embed] }).catch(() => {});
				}
			}
		} catch (err) {
			console.error('❌ Error sethargapoin:', err);
			return interaction.reply({
				content:
					'⚠️ Terjadi kesalahan saat mengatur harga poin.',
				ephemeral: true,
			});
		}
	},
}).toJSON();