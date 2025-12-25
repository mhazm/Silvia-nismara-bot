const { EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const GuildSettings = require('../../models/guildsetting');

module.exports = new Event({
	event: 'interactionCreate',
	once: false,

	run: async (__client__, interaction) => {
		try {
			if (!interaction.isModalSubmit()) return;
			if (
				!interaction.customId.startsWith(
					'submit_close_interview_',
				)
			)
				return;

			const guild = interaction.guild;
			const guildId = guild.id;
			const settings = await GuildSettings.findOne({ guildId });

			const targetUserId =
				interaction.customId.split('_')[3];
			const reason =
				interaction.fields.getTextInputValue(
					'close_reason',
				);

			const channel = interaction.channel;

			// =========================
			// DM USER
			// =========================
			try {
				const user =
					await __client__.users.fetch(
						targetUserId,
					);

				const dmEmbed = new EmbedBuilder()
					.setTitle('📋 Interview Ditutup')
					.setColor('Red')
					.setDescription(
						`Halo ${user},\n\n` +
							`Sesi interview kamu telah **ditutup**.\n\n` +
							`📌 **Alasan:**\n${reason}`,
					)
					.setTimestamp();

				await user.send({ embeds: [dmEmbed] });
			} catch {
				// ignore DM fail
			}

			// =========================
			// LOG CHANNEL
			// =========================
			if (settings?.channelLog) {
				const logChannel =
					guild.channels.cache.get(
						settings.channelLog,
					);

				if (logChannel) {
					const logEmbed = new EmbedBuilder()
						.setTitle(
							'🔒 Interview Closed',
						)
						.setColor('DarkRed')
						.setDescription(
							`👤 User: <@${targetUserId}>\n` +
								`🧑‍💼 Ditutup oleh: <@${interaction.user.id}>\n\n` +
								`📌 **Alasan:**\n${reason}`,
						)
						.setTimestamp();

					logChannel.send({
						embeds: [logEmbed],
					});
				}
			}

			await interaction.reply({
				content:
					'✅ Interview berhasil ditutup.',
				ephemeral: true,
			});

			// =========================
			// DELETE CHANNEL
			// =========================
			setTimeout(() => {
				channel.delete(
					'Interview closed by manager',
				);
			}, 3000);
		} catch (err) {
			console.error(
				'Interview modal submit error:',
				err,
			);
		}
	},
});