const {
	ChatInputCommandInteraction,
	EmbedBuilder,
} = require('discord.js');
const DiscordBot = require('../../client/DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Contract = require('../../models/contract');
const ContractHistory = require('../../models/ContractHistorys');
const GuildSettings = require('../../models/guildsetting.js');

module.exports = new ApplicationCommand({
	command: {
		name: 'endcontract',
		description: 'Akhiri kontrak perusahaan aktif',
		type: 1,
	},
	options: {
		allowedRoles: ['manager'],
	},

	/**
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
	run: async (client, interaction) => {
		await interaction.deferReply({ ephemeral: true });

		try {
			const guildId = interaction.guild.id;

			// 🔹 Ambil kontrak terakhir dari history
			const lastHistory = await ContractHistory.findOne({ guildId })
				.sort({ startDate: -1 });

			if (!lastHistory) {
				return interaction.editReply(
					'⚠️ Tidak ada kontrak yang bisa diakhiri.'
				);
			}

			// 🔹 Jika belum diakhiri, tutup kontraknya
			if (!lastHistory.endDate) {
				lastHistory.endDate = new Date();
				lastHistory.durationDays = Math.ceil(
					(lastHistory.endDate - lastHistory.startDate) /
						(1000 * 60 * 60 * 24)
				);
				await lastHistory.save();
			}

			// 🔹 Hapus kontrak aktif
			const activeContract = await Contract.findOne({ guildId });
			if (activeContract) {
				await activeContract.deleteOne();
			}

			// 🔹 Ambil data untuk embed
			const {
				companyName,
				imageUrl,
				startDate,
				endDate,
				durationDays,
			} = lastHistory;

			// 🔹 Ambil channel log (jika ada)
			const setting = await GuildSettings.findOne({ guildId });
			const logChannel = setting
				? interaction.guild.channels.cache.get(
						setting.eventNotifyChannel
				  )
				: null;

			// 🔹 Embed
			const embed = new EmbedBuilder()
				.setColor('#00AEEF')
				.setTitle('📦 Special Contract Diakhiri')
				.addFields(
					{
						name: '🏢 Nama Perusahaan',
						value: companyName || 'N/A',
					},
					{
						name: '🕒 Kontrak Dimulai',
						value: startDate
							? `<t:${Math.floor(startDate.getTime() / 1000)}:f>`
							: 'N/A',
						inline: true,
					},
					{
						name: '🕒 Kontrak Berakhir',
						value: endDate
							? `<t:${Math.floor(endDate.getTime() / 1000)}:f>`
							: 'N/A',
						inline: true,
					},
					{
						name: '⏳ Durasi Kontrak (hari)',
						value: durationDays ? durationDays.toString() : 'N/A',
						inline: true,
					}
				)
				.setFooter({
					text: 'Gunakan /contractstatus untuk melihat status saat ini',
				})
				.setTimestamp();

			if (imageUrl) embed.setImage(imageUrl);

			// 🔹 Kirim ke log channel (jika ada)
			if (logChannel) {
				logChannel.send({ embeds: [embed] }).catch(() => {});
			}

			// 🔹 Reply ke user
			return interaction.editReply({
				content:
					'✅ Special Contract berhasil diakhiri dan dicatat dalam riwayat.',
				embeds: [embed],
			});
		} catch (err) {
			console.error('❌ Gagal mengakhiri contract:', err);
			return interaction.editReply(
				'⚠️ Terjadi kesalahan saat mengakhiri kontrak.'
			);
		}
	},
}).toJSON();