const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require('discord.js');

const ApplicationCommand = require('../../structure/ApplicationCommand.js');

module.exports = new ApplicationCommand({
	command: {
		name: 'bayarpoin',
		description: 'Tebus penalty point menggunakan NC (Pindah ke Web)',
		type: 1,
	},
	options: {
		allowedRoles: ['driver'],
	},

	run: async (client, interaction) => {
		try {
			const webUrl =
				process.env.WEB_URL || 'https://transport.nismara.web.id';
			const link = `${webUrl}/dashboard/points`;

			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setLabel('Tebus di Web Dashboard')
					.setStyle(ButtonStyle.Link)
					.setURL(link),
			);

			const embed = new EmbedBuilder()
				.setTitle('⚠️ Command Dinonaktifkan')
				.setDescription(
					'Command `/bayarpoin` via bot discord sekarang sudah tidak berfungsi.\n\n' +
						'Silakan lakukan pembayaran penalty secara langsung melalui website dashboard Nismara Transport.',
				)
				.setColor('Orange');

			return interaction.reply({
				embeds: [embed],
				components: [row],
				ephemeral: true,
			});
		} catch (err) {
			console.error('❌ Error bayarpoin:', err);
			return interaction.reply({
				content: '⚠️ Terjadi kesalahan saat memproses permintaan.',
				ephemeral: true,
			});
		}
	},
}).toJSON();
