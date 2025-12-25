const Event = require('../../structure/Event');
const assignDriver = require('../../utils/assignDriver');

module.exports = new Event({
	event: 'interactionCreate',
	run: async (__client__, interaction) => {
		if (!interaction.isButton()) return;
		if (!interaction.customId.startsWith('confirm_accept_driver:'))
			return;

		const userId = interaction.customId.split(':')[1];
		const member = await interaction.guild.members.fetch(userId);

		const result = await assignDriver({
			guild: interaction.guild,
			executor: interaction.user,
			targetMember: member,
			__client__,
		});

		if (result.status !== 'ok') {
			return interaction.update({
				content: `❌ ${result.message}`,
				components: [],
			});
		}

		await interaction.update({
			content: `✅ <@${member.id}> **berhasil diangkat menjadi Driver**.`,
			components: [],
		});
	},
}).toJSON();