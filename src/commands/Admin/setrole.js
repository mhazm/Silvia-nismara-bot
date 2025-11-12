const { ChatInputCommandInteraction, ApplicationCommandOptionType, AttachmentBuilder, PermissionFlagsBits } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const GuildSettings = require("../../models/guildsetting");


module.exports = new ApplicationCommand({
    command: {
        name: 'setrole',
        description: 'Set role khusus untuk perintah tertentu',
        type: 1,
        options: [
            {
                name: "type",
                description: "Jenis role yang ingin diatur",
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: "Manager", value: "manager" },
                    { name: "Moderator", value: "moderator" },
                    { name: "Driver", value: "driver" },
                ],
            },
            {
                name: "role",
                description: "Pilih role Discord",
                type: ApplicationCommandOptionType.Role,
                required: true,
            },
        ],
    },
    options: {
        botDevelopers: true,
        allowedRoles: ['manager'],
        cooldown: 10000, // 10 detik
    },
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {

        try {
            const guildId = interaction.guild.id;
            const roleType = interaction.options.getString("type");
            const role = interaction.options.getRole("role");

            let settings = await GuildSettings.findOne({ guildId });
            if (!settings) settings = new GuildSettings({ guildId });

            // tambahkan role ID ke array jika belum ada
            if (!settings.roles[roleType]) settings.roles[roleType] = [];
            if (!settings.roles[roleType].includes(role.id)) {
                settings.roles[roleType].push(role.id);
                await settings.save();
            }

            await interaction.reply({
                content: `✅ Role **${role.name}** berhasil ditambahkan sebagai **${roleType}**.`,
                ephemeral: true,
            });

        } catch (err) {
            console.error("❌ Gagal menyimpan role:", err);
            return interaction.editReply("⚠️ Terjadi kesalahan saat menyimpan data ke database.");
        }
    }
}).toJSON();