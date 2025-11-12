const { ChatInputCommandInteraction, ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const Contract = require("../../models/contract");
const ContractHistory = require("../../models/ContractHistorys");

module.exports = new ApplicationCommand({
    command: {
        name: 'setcontract',
        description: 'Set perussahaan kontrak aktif',
        type: 1,
        options: [{
            name: 'name',
            description: 'Nama Perusahaan Kontrak (Harus sama dengan source_company_name di Trucky)',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'image',
            description: 'URL Gambar Perusahaan Kontrak',
            type: ApplicationCommandOptionType.String,
            required: false
        }]
    },
    options: {
        allowedRoles: ['manager'], // Hanya user dengan role ini yang bisa menjalankan command
    },
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const companyName = interaction.options.getString("name");
            const companyImage = interaction.options.getString("image");
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            // 🔹 Validasi URL gambar (jika ada)
            if (companyImage && !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(companyImage)) {
                return interaction.editReply("⚠️ URL gambar tidak valid. Harus berupa tautan langsung ke file gambar (jpg/png/gif/webp).");
            }

            // 🔹 Tutup kontrak lama di history (jika masih aktif)
            const lastHistory = await ContractHistory
                .findOne({ guildId }) // cari kontrak terakhir di guild ini
                .sort({ startDate: -1 }); // urutkan dari yang terbaru
            
                if (lastHistory && !lastHistory.endDate) {
                lastHistory.endDate = new Date();
                lastHistory.durationDays = Math.ceil(
                (lastHistory.endDate - lastHistory.startDate) / (1000 * 60 * 60 * 24)
                );
                await lastHistory.save();
            }

            // 🔹 Simpan kontrak baru ke history
            await ContractHistory.create({
                guildId: guildId,
                companyName: companyName,
                imageUrl: companyImage,
                setBy: userId,
                startDate: new Date(),
            });

            // 🔹 Simpan / update kontrak aktif per guild
            const existing = await Contract.findOne({ guildId: guildId });
            if (existing) {
                existing.companyName = companyName;
                existing.imageUrl = companyImage;
                existing.setBy = userId;
                existing.createdAt = new Date();
                await existing.save();
            } else {
                await Contract.create({
                guildId: guildId,
                companyName: companyName,
                imageUrl: companyImage,
                setBy: userId,
                });
            }

            // 🔹 Kirim embed konfirmasi
            const embed = new EmbedBuilder()
                .setColor("#00AEEF")
                .setTitle("📦 Special Contract Ditetapkan")
                .addFields(
                { name: "🏢 Nama Perusahaan", value: companyName, inline: true },
                { name: "👤 Diset oleh", value: `<@${userId}>`, inline: true },
                { name: "🕒 Tanggal Mulai", value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
                )
                .setFooter({ text: "Gunakan /contractstatus untuk melihat status saat ini" })
                .setTimestamp();

            if (companyImage) embed.setImage(companyImage);

            return interaction.editReply({
                content: "✅ Special Contract berhasil diset & dicatat dalam riwayat!",
                embeds: [embed],
            });

        } catch (err) {
            console.error("❌ Gagal menyimpan contract:", err);
            return interaction.editReply("⚠️ Terjadi kesalahan saat menyimpan data ke database.");
        }
    }
}).toJSON();