const {
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const Point = require("../../models/points");
const PointHistory = require("../../models/pointhistory");

module.exports = new ApplicationCommand({
  command: {
    name: "allpoint",
    description: "Melihat seluruh point yang ada di dalam server",
    type: 1,
    options: [],
  },
  /**
   *
   * @param {DiscordBot} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guild.id;

      const settings = await GuildSettings.findOne({ guildId });
      if (!settings) {
        return interaction.editReply(
          "⚠️ Guild belum memiliki pengaturan roles driver."
        );
      }

      const driverRoles = settings.roles?.driver || [];

      // Ambil semua poin
      const allPoints = await Point.find({ guildId }).sort({ totalPoints: -1 });

      // Filter hanya user yang punya driver role
      const driverList = [];

      for (const p of allPoints) {
        try {
          const member = await interaction.guild.members.fetch(p.userId);
          const isDriver = member.roles.cache.some((r) =>
            driverRoles.includes(r.id)
          );
          if (isDriver) {
            driverList.push({
              id: p.userId,
              tag: member.user.tag,
              points: p.totalPoints,
            });
          }
        } catch {
          // user sudah keluar server → skip
        }
      }

      if (driverList.length === 0) {
        return interaction.editReply("⚠️ Tidak ada driver yang memiliki poin.");
      }

      // Ambil top 10
      const top = driverList.slice(0, 10);

      let desc = top
        .map(
          (user, i) => `**#${i + 1}** — <@${user.id}> — **${user.points} poin**`
        )
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle("🏆 Driver Point Leaderboard")
        .setColor("Gold")
        .setDescription(desc)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Gagal memuat data point:", err);
      return interaction.editReply(
        "⚠️ Terjadi kesalahan saat memuat data dari database."
      );
    }
  },
}).toJSON();
