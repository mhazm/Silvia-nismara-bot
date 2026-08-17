const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');

module.exports = new ApplicationCommand({
	command: {
		name: 'claim',
		description: 'Claim coupon (Pindah ke Web)',
		type: 1,
	},
	options: {
		allowedRoles: ['driver'],
	},
	run: async (client, interaction) => {
		try {
			const webUrl =
				process.env.WEB_URL || 'https://transport.nismara.web.id';
			const link = `${webUrl}/dashboard/coupons`;

			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setLabel('Claim Kupon di Web Dashboard')
					.setStyle(ButtonStyle.Link)
					.setURL(link),
			);

			const embed = new EmbedBuilder()
				.setTitle('⚠️ Command Dinonaktifkan')
				.setDescription(
					'Command `/claim` via bot discord sekarang sudah tidak berfungsi.\n\n' +
					'Silakan klaim kupon secara langsung melalui website dashboard Nismara Transport.',
				)
				.setColor('Orange');

			return interaction.reply({
				embeds: [embed],
				components: [row],
				ephemeral: true,
			});
		} catch (err) {
			console.error('❌ Gagal claim coupon:', err);
			return interaction.reply({
				content: '⚠️ Terjadi kesalahan saat memproses permintaan.',
				ephemeral: true,
			});
		}
	},
}).toJSON();
