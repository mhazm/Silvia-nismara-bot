const { ChatInputCommandInteraction, EmbedBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const SpecialContractHistory = require("../../models/specialContractHistory");

module.exports = new ApplicationCommand({
    command: {
        name: "scleaderboard",
        description: "Leaderboard driver berdasarkan jumlah Special Contract",
        type: 1
    },
	/**
	 *
	 * @param {DiscordBot} client
	 * @param {ChatInputCommandInteraction} interaction
	 */
    run: async (client, interaction) => {
        await interaction.deferReply();

        const guildId = interaction.guild.id;

        const leaderboard = await SpecialContractHistory.aggregate([
            { $match: { guildId } },
            { $group: { _id: "$driverId", total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 10 }
        ]);

        if (!leaderboard.length)
            return interaction.editReply("❌ Tidak ada data Special Contract.");

        const lines = await Promise.all(
            leaderboard.map(async (item, index) => {
                const user = await interaction.guild.members.fetch(item._id).catch(() => null);
                return `**#${index+1}** — ${user ? user.displayName : "Unknown"} — **${item.total} job**`;
            })
        );

        const embed = new EmbedBuilder()
            .setTitle("🏆 Special Contract Leaderboard")
            .setColor("Purple")
            .setDescription(lines.join("\n"))
            .setTimestamp();

        interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
