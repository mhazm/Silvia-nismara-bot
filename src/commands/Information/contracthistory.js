const { ChatInputCommandInteraction, ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const ContractHistory = require("../../models/ContractHistorys");

module.exports = new ApplicationCommand({
    command: {
        name: 'contracthistory',
        description: 'Melihat riwayat special contract terakhir',
    },
    options: {
        allowedRoles: ['manager'],
        cooldown: 10000
    },
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        await interaction.deferReply();

        try {
        const guildId = interaction.guild.id;
        if (!guildId) {
            return interaction.editReply("⚠️ Perintah ini hanya dapat digunakan di dalam server.");
        }

        const guildAvatar = interaction.guild.iconURL({ dynamic: true });

        const history = await ContractHistory
        .find({ guildId: guildId })
        .sort({ startDate: -1 }).limit(10);

        if (!history.length) {
            return interaction.editReply("📭 Belum ada data kontrak yang tersimpan.");
        }

        const embed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle("🏢 Riwayat Special Contract")
            .setThumbnail(guildAvatar)
            .setFooter({ text: "Menampilkan 10 kontrak terakhir" })
            .setTimestamp();

        history.forEach((c, index) => {
            const start = c.startDate
            ? new Date(c.startDate).toLocaleDateString("id-ID", {
                dateStyle: "medium",
                timeZone: "Asia/Jakarta",
                })
            : "-";

            const end = c.endDate
            ? new Date(c.endDate).toLocaleDateString("id-ID", {
                dateStyle: "medium",
                timeZone: "Asia/Jakarta",
                })
            : "Masih Berjalan";

            embed.addFields({
            name: `${index + 1}. ${c.companyName}`,
            value: `📅 **${start} → ${end}**\n⏱️ Durasi: ${
                c.durationDays ? `${c.durationDays} hari` : "Sedang berlangsung"
            }\n👤 Diset oleh: <@${c.setBy}>`,
            });
        });

        return interaction.editReply({ embeds: [embed] });
        } catch (err) {
        console.error("❌ Gagal memuat riwayat kontrak:", err);
        return interaction.editReply("⚠️ Terjadi kesalahan saat memuat riwayat kontrak.");
        }
    }
}).toJSON();