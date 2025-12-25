const {
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	EmbedBuilder,
} = require('discord.js');

const Event = require('../../structure/Event');
const GuildSettings = require('../../models/guildsetting');

module.exports = new Event({
	event: 'interactionCreate',
	once: false,

	run: async (__client__, interaction) => {
		try {
			// =========================
			// BUTTON CLICK
			// =========================
			if (!interaction.isButton()) return;
			if (!interaction.customId.startsWith('close_interview_'))
				return;

			const guildId = interaction.guild.id;
			const settings = await GuildSettings.findOne({ guildId });
			if (!settings) return;

			// =========================
			// ROLE CHECK (MANAGER)
			// =========================
			const member = await interaction.guild.members.fetch(
				interaction.user.id,
			);

			const managerRoles = settings.roles?.manager || [];
			const isManager = member.roles.cache.some((r) =>
				managerRoles.includes(r.id),
			);

			if (!isManager) {
				return interaction.reply({
					content:
						'❌ Hanya **Manager** yang dapat menutup interview.',
					ephemeral: true,
				});
			}

			const targetUserId =
				interaction.customId.split('_')[2];

			// =========================
			// SHOW MODAL
			// =========================
			const modal = new ModalBuilder()
				.setCustomId(`submit_close_interview_${targetUserId}`)
				.setTitle('Tutup Interview');

			const reasonInput = new TextInputBuilder()
				.setCustomId('close_reason')
				.setLabel('Alasan penutupan interview')
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(true)
				.setPlaceholder(
					'Contoh: Interview selesai / Tidak lolos / Akan dihubungi kembali',
				);

			modal.addComponents(
				new ActionRowBuilder().addComponents(reasonInput),
			);

			await interaction.showModal(modal);
		} catch (err) {
			console.error('Interview button error:', err);
		}
	},
});