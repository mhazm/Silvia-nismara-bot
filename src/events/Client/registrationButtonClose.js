const GuildSettings = require('../../models/guildsetting');
const Event = require('../../structure/Event');

module.exports = new Event({
	event: 'interactionCreate',
	once: false,
	run: async (__client__, interaction) => {
		if (!interaction.isButton()) return;

		// Cek apakah Custom ID tombol sesuai
		if (interaction.customId === 'close_registration_ticket') {
			try {
				// Mengambil pengaturan guild (database)
				const settings = await GuildSettings.findOne({
					guildId: interaction.guild.id,
				});

				if (!settings) {
					return interaction.reply({
						content:
							'❌ Pengaturan server tidak ditemukan di database.',
						ephemeral: true,
					});
				}

				// Mengambil data member yang mengklik tombol
				const member = await interaction.guild.members.fetch(
					interaction.user.id,
				);

				// Pengecekan role manager
				const isManager = member.roles.cache.some((r) =>
					settings.roles?.manager?.includes(r.id),
				);

				// Jika bukan manager, tolak akses
				if (!isManager) {
					return interaction.reply({
						content:
							'❌ Hanya **Manager** yang dapat menutup pendaftaran.',
						ephemeral: true,
					});
				}

				// Proses penutupan channel jika lolos pengecekan
				await interaction.reply({
					content: '🔒 Menutup tiket pendaftaran dalam 5 detik...',
				});

				// Hapus channel setelah 5 detik
				setTimeout(() => {
					interaction.channel.delete().catch((err) => {
						console.error('Gagal menghapus channel:', err);
					});
				}, 5000);
			} catch (error) {
				console.error('Terjadi kesalahan saat menutup tiket:', error);
				await interaction.reply({
					content:
						'Terjadi kesalahan sistem saat mencoba menutup tiket.',
					ephemeral: true,
				});
			}
		}
	},
}).toJSON();
