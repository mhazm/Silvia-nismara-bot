const {
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
} = require('discord.js');
const Event = require('../../structure/Event');
const GuildSettings = require('../../models/guildsetting');

module.exports = new Event({
	event: 'interactionCreate',
	once: false,
	run: async (__client__, interaction) => {
		if (!interaction.isButton()) return;
		if (!interaction.customId.startsWith('close_interview_')) return;

		const settings = await GuildSettings.findOne({
			guildId: interaction.guild.id,
		});
		if (!settings) return;

		const member = await interaction.guild.members.fetch(
			interaction.user.id,
		);

		const isManager = member.roles.cache.some((r) =>
			settings.roles?.manager?.includes(r.id),
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

		const modal = new ModalBuilder()
			.setCustomId(`submit_close_interview_${targetUserId}`)
			.setTitle('Tutup Interview');

		const reasonInput = new TextInputBuilder()
			.setCustomId('close_reason')
			.setLabel('Alasan penutupan interview')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(true);

		modal.addComponents(
			new ActionRowBuilder().addComponents(reasonInput),
		);

		await interaction.showModal(modal);
	},
}).toJSON();
