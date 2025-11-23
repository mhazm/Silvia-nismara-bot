const {
    ChatInputCommandInteraction,
    ApplicationCommandOptionType,
    EmbedBuilder,
} = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const NCEvent = require("../../models/ncevent");

module.exports = new ApplicationCommand({
    command: {
        name: "checkevent",
        description: "Cek apakah NC Boost Event sedang berlangsung",
        type: 1,
    },
    options: {
        allowedRoles: ["driver"], // opsional
    },

    /**
     *
     * @param {DiscordBot} client
     * @param {ChatInputCommandInteraction} interaction
     */
    run: async (client, interaction) => {
        await interaction.deferReply({ ephemeral: false });

        const guildId = interaction.guild.id;
        const ncEvent = await NCEvent.findOne({ guildId });

        if (!ncEvent || (ncEvent.endAt <= new Date())) {
            const embed = new EmbedBuilder()
                .setTitle("🎉 NC Boost Event Status")
                .setColor("Red")
                .setDescription("🔕 **Saat ini tidak ada event NC Boost yang aktif.**")
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("🎉 NC Boost Event Sedang Aktif!")
            .setColor("Green")
            .addFields(
                {
                    name: "📈 Multiplier",
                    value: `x${ncEvent.multiplier}`,
                    inline: true
                },
                {
                    name: "⏳ Berakhir Pada",
                    value: `<t:${Math.floor(ncEvent.endAt.getTime() / 1000)}:F>\n(<t:${Math.floor(ncEvent.endAt.getTime() / 1000)}:R>)`,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({ text: "Nismara Transport - Event Checker" });

        return interaction.editReply({ embeds: [embed] });
    }
}).toJSON();