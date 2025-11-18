const { ChatInputCommandInteraction, ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const Point = require("../../models/points");
const PointHistory = require("../../models/pointhistory");
const GuildSettings = require("../../models/guildsetting");

module.exports = new ApplicationCommand({
    command: {
        name: 'addpoint',
        description: 'Tambahkan poin ke pengguna',
        type: 1,
        options: [{
            name: 'driver',
            description: 'Pilih driver yang akan ditambahkan poin',
            type: ApplicationCommandOptionType.User,
            required: true
        },
        {
            name: 'jumlah',
            description: 'Jumlah poin yang akan ditambahkan',
            type: ApplicationCommandOptionType.Integer,
            required: true
        },
        {
            name: 'alasan',
            description: 'Alasan penambahan poin',
            type: ApplicationCommandOptionType.String,
            required: true
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

        const guildId = interaction.guild.id;
        const managerId = interaction.user.id;
        const driver = interaction.options.getUser("driver");
        const jumlah = interaction.options.getInteger("jumlah");
        const alasan = interaction.options.getString("alasan");

        const settings = await GuildSettings.findOne({ guildId });
        if (!settings) {
            return interaction.editReply("⚠️ Guild belum memiliki konfigurasi settings.");
        }

        // Cek apakah driver bukan manager
        if (driver.bot) return interaction.editReply("❌ Kamu tidak bisa memberikan poin ke bot.");

        const driverRoles = settings.roles?.driver || [];
        const logChannelId = settings.channelLog;

        const member = await interaction.guild.members.fetch(driver.id);

        // ❗ VALIDASI: apakah dia punya role driver?
        const isDriver = member.roles.cache.some(r => driverRoles.includes(r.id));
        if (!isDriver) {
            return interaction.editReply("❌ User ini **bukan driver** sehingga tidak dapat diberi poin.");
        }

        // Ambil atau buat data driver
        let pointData = await Point.findOne({ guildId, userId: driver.id });
        if (!pointData) {
            pointData = await Point.create({ 
                guildId, 
                userId: driver.id, 
                totalPoints: 0 });
        }

        // Tambah poin
        pointData.totalPoints += jumlah;
        await pointData.save();

        // Catat ke history
        await PointHistory.create({
            guildId,
            userId: driver.id,
            managerId,
            points: jumlah,
            reason: alasan,
            type: "add",
        });

        // Kirim notifikasi embed
        const embed = new EmbedBuilder()
        .setTitle("🎯 Poin Ditambahkan!")
        .setColor("Red")
        .addFields(
            { name: "Driver", value: `<@${driver.id}>`, inline: true },
            { name: "Jumlah Poin", value: `${jumlah}`, inline: true },
            { name: "Alasan", value: alasan },
        )
        .setFooter({ text: `Diberikan oleh ${interaction.user.username}` })
        .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // 🔹 Logging ke channel log
        if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                .setTitle("📝 Add Point Log")
                .setColor("Blue")
                .addFields(
                    { name: "Manager", value: `<@${managerId}>`, inline: true },
                    { name: "Driver", value: `<@${driver.id}>`, inline: true },
                    { name: "Poin", value: `+${jumlah}`, inline: true },
                    { name: "Alasan", value: alasan },
                )
                .setTimestamp();

                logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }

        // DM Embed ke driver
        const dmEmbed = new EmbedBuilder()
        .setTitle("⚠️ Kamu Telah mendapatkan Poin!")
        .setColor("Red")
        .setDescription(
            `Kamu baru saja menerima **+${jumlah} poin** dari ${interaction.user.username} di server **${interaction.guild.name}**.`
        )
        .addFields(
            { name: "📝 Alasan", value: alasan },
            { name: "📊 Total Poin Sekarang", value: `${pointData.totalPoints}` }
        )
        .setTimestamp()
        .setFooter({ text: "Perbaiki performamu agar tidak terjadi lagi ya." });

        // 🔸 Coba kirim DM ke user
        try {
            await driver.send({ embeds: [dmEmbed] });
        } catch (err) {
        console.warn(`Tidak bisa kirim DM ke ${driver.tag} (DM tertutup).`);
        }
    }
}).toJSON();