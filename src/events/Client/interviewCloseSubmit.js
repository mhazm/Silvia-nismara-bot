const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const GuildSettings = require('../../models/guildsetting');

module.exports = new Event({
	event: 'interactionCreate',
	once: false,
	run: async (__client__, interaction) => {
		if (!interaction.isModalSubmit()) return;
		if (!interaction.customId.startsWith('submit_close_interview_'))
			return;

		const targetUserId =
			interaction.customId.split('_')[3];
		const reason =
			interaction.fields.getTextInputValue('close_reason');

		const settings = await GuildSettings.findOne({
			guildId: interaction.guild.id,
		});

		// DM user
		try {
			const user = await __client__.users.fetch(
				targetUserId,
			);

			await user.send({
				embeds: [
					new EmbedBuilder()
						.setTitle('📋 Interview Ditutup')
						.setColor('Red')
						.setDescription(
							`Sesi interview kamu telah ditutup.\n\n📌 **Alasan:**\n${reason}`,
						)
						.setTimestamp(),
				],
			});
		} catch {}

		// Log
		if (settings?.channelLog) {
			const logChannel =
				interaction.guild.channels.cache.get(
					settings.channelLog,
				);

			if (logChannel) {
				logChannel.send({
					embeds: [
						new EmbedBuilder()
							.setTitle('🔒 Interview Closed')
							.setColor('DarkRed')
							.setDescription(
								`👤 User: <@${targetUserId}>\n🧑‍💼 Oleh: <@${interaction.user.id}>\n\n📌 **Alasan:**\n${reason}`,
							)
							.setTimestamp(),
					],
				});
			}
		}

		await interaction.reply({
			content: '✅ Interview berhasil ditutup.',
			ephemeral: true,
		});

		setTimeout(() => {
			interaction.channel?.delete(
				'Interview closed',
			);
		}, 3000);
	},
}).toJSON();