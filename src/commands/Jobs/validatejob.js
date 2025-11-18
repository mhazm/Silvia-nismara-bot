const {
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  EmbedBuilder,
} = require("discord.js");

const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");

const DriverLink = require("../../models/driverlink");
const Point = require("../../models/points");
const PointHistory = require("../../models/pointhistory");
const GuildSettings = require("../../models/guildsetting");

module.exports = new ApplicationCommand({
  command: {
    name: "validatejob",
    description: "Validasi job Trucky untuk mengurangi poin penalti secara otomatis.",
    type: 1,
    options: [
      {
        name: "jobid",
        description: "Job ID dari Trucky",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
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
      const userId = interaction.user.id;
      const jobId = interaction.options.getInteger("jobid");

      // =========================================
      // 1. CEK APAKAH DRIVER TERDAFTAR
      // =========================================
      const link = await DriverLink.findOne({ guildId, userId });

      if (!link)
        return interaction.editReply(
          "❌ Kamu belum terdaftar sebagai driver resmi Nismara.\nGunakan `/registerdriver` dulu."
        );

      // =========================================
      // 2. FETCH DATA JOB DARI TRUCKY
      // =========================================
      const res = await fetch(`https://e.truckyapp.com/api/v1/job/${jobId}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "SilviaBot/1.0",
        },
      });

      if (!res.ok)
        return interaction.editReply("❌ Job ID tidak ditemukan di Trucky API.");

      const job = await res.json();

      // =========================================
      // 3. CEK APAKAH INI JOB DRIVER SENDIRI
      // =========================================
      if (job.driver.id !== link.truckyId)
        return interaction.editReply(
          `❌ Job ini bukan milik kamu!\n` +
          `• Driver job: **${job.driver.name}**\n` +
          `• Driver terdaftar: **${link.truckyName}**`
        );

      // =========================================
      // 4. CEK STATUS JOB
      // =========================================
      if (job.status !== "completed")
        return interaction.editReply("⚠️ Job ini belum selesai di Trucky.");

      // =========================================
      // 5. CEK APAKAH HARDCORE/SIMULATION
      // =========================================
      const mode = job.gameplay_type; // biasanya "hardcore", "simulation_active", dll

      if (!["hardcore", "simulation_active"].includes(mode))
        return interaction.editReply(
          "❌ Job ini tidak valid karena **bukan Hardcore atau Simulation Active**."
        );

      // =========================================
      // 6. CEK RATING MINIMAL 4
      // =========================================
      const rating = job.delivery_rating_details?.rating ?? 0;

      if (rating < 4)
        return interaction.editReply(
          `❌ Rating job kamu terlalu rendah!\nRating sekarang: **${rating}**, minimal **4**.`
        );

      // =========================================
      // 7. HITUNG DISTANCE
      // =========================================
      const distance = Math.floor(job.real_driven_distance_km);

      if (distance <= 0)
        return interaction.editReply("❌ Trucky tidak memberikan data jarak.");

      // =========================================
      // 8. HITUNG PENGURANGAN POINT
      // =========================================
      const deducted = Math.floor(distance / 500);

      if (deducted <= 0)
        return interaction.editReply(
          `⚠️ Jarak **${distance} km** belum cukup untuk mengurangi poin.\n` +
          `• Minimal 500 km = -1 poin`
        );

      // =========================================
      // 9. UPDATE POINT DATABASE
      // =========================================
      let record = await Point.findOne({ guildId, userId });

      if (!record) {
        record = await Point.create({
          guildId,
          userId,
          totalPoints: 0,
        });
      }

      record.totalPoints = Math.max(record.totalPoints - deducted, 0);
      await record.save();

      // =========================================
      // 10. SIMPAN RIWAYAT POINT
      // =========================================
      await PointHistory.create({
        guildId,
        userId,
        points: deducted,
        type: "remove",
        reason: `Validasi job #${jobId} (${distance} km)`,
        managerId: client.user.id, // BOT SEBAGAI PENGURANG
      });

      // =========================================
      // 11. KIRIM DM KE DRIVER
      // =========================================
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle("📉 Job Validated – Point Deducted")
          .setColor("Red")
          .setDescription(
            `Job kamu telah divalidasi secara otomatis!\n` +
            `**-${deducted} poin** telah dikurangi dari akun kamu.`
          )
          .addFields(
            { name: "Job ID", value: `#${jobId}`, inline: true },
            { name: "Distance", value: `${distance} km`, inline: true },
            { name: "Mode", value: mode, inline: true },
            { name: "Rating", value: `${rating}`, inline: true },
            { name: "Total Poin Sekarang", value: `${record.totalPoints}`, inline: false }
          )
          .setTimestamp();

        await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch {}

      // =========================================
      // 12. LOG KE CHANNEL
      // =========================================
      const settings = await GuildSettings.findOne({ guildId });

      if (settings?.channelLog) {
        const logChannel = interaction.guild.channels.cache.get(settings.channelLog);

        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle("📉 Job Validation Log")
            .setColor("Red")
            .addFields(
              { name: "Driver", value: `<@${userId}> (${link.truckyName})`, inline: false },
              { name: "Job ID", value: `#${jobId}`, inline: true },
              { name: "Distance", value: `${distance} km`, inline: true },
              { name: "Points Deducted", value: `${deducted}`, inline: true },
              { name: "Mode", value: mode, inline: true },
              { name: "Rating", value: `${rating}`, inline: true }
            )
            .setFooter({ text: "Automatic System" })
            .setTimestamp();

          logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      // =========================================
      // 13. BALAS INTERACTION
      // =========================================
      return interaction.editReply(
        `✅ **Job berhasil divalidasi!**\n` +
        `• Distance: **${distance} km**\n` +
        `• Rating: **${rating}**\n` +
        `• Dikurangi: **${deducted} poin**`
      );

    } catch (err) {
      console.error("❌ Error validatejob:", err);
      return interaction.editReply("⚠️ Terjadi kesalahan internal.");
    }
  },
}).toJSON();
