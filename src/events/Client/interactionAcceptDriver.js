const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
	event: 'interactionCreate',
	run: async (__client__, interaction) => {
		if (!interaction.isButton()) return;
		if (!interaction.customId.startsWith('accept_driver:')) return;

		const userId = interaction.customId.split(':')[1];

		// ⛔ permission check (manager only)
		if (
			!interaction.member.roles.cache.some((r) =>
				r.name?.toLowerCase().includes('manager'),
			)
		) {
			return interaction.reply({
				content: '❌ Hanya manager yang boleh melakukan ini.',
				ephemeral: true,
			});
		}

		// 🔔 CONFIRMATION BUTTONS
		const confirmRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`confirm_accept_driver:${userId}`)
				.setLabel('✅ Ya, Terima Driver')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId('cancel_accept_driver')
				.setLabel('❌ Batal')
				.setStyle(ButtonStyle.Secondary),
		);

		await interaction.reply({
			content:
				`⚠️ **Konfirmasi Pengangkatan Driver**\n` +
				`Apakah kamu yakin ingin mengangkat <@${userId}> menjadi **Driver**?\n\n` +
				`Tindakan ini akan:\n` +
				`• Menghapus role magang\n` +
				`• Menambahkan role driver\n` +
				`• Mereset point penalty (jika ada)`,
			components: [confirmRow],
			ephemeral: true,
		});
	},
}).toJSON();
