const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { drawLotto } = require('../../utils/lotto');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lottodraw')
		.setDescription('Menarik undian Nismara Lotto secara manual (Admin Only)')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction, client) {
		await interaction.deferReply();

		const resultEmbed = await drawLotto(client);

		if (!resultEmbed) {
			return interaction.editReply('❌ Tidak ada undian Lotto yang aktif atau terjadi kesalahan saat pengundian.');
		}

		await interaction.editReply({ embeds: [resultEmbed] });
	},
};
