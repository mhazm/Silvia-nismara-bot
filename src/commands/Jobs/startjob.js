require("dotenv").config();
const { ChatInputCommandInteraction, ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const Contract = require("../../models/contract");
const ActiveJob = require("../../models/activejob");

module.exports = new ApplicationCommand({
    command: {
        name: 'startjob',
        description: 'Memulai special contract job dengan Job ID dari Trucky',
        type: 1,
        options: [{
            name: 'jobid',
            description: 'Masukan Job ID dari Trucky',
            type: ApplicationCommandOptionType.String,
            required: true
        }]
    },
    options: {
        allowedRoles: ['driver'],
        cooldown: 10000
    },
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        const jobId = interaction.options.getString("jobid");
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
      const contract = await Contract.findOne({ guildId });
      const notifyChannel = contract?.channelId
                    ? await interaction.guild.channels.fetch(contract.channelId).catch(() => null)
                    : null;
      if (!contract || !contract.companyName)
        return interaction.editReply("⚠️ Tidak ada kontrak aktif di server ini.");

      // Ambil data job dari Trucky API
      console.log(`Fetching job data for Job ID: ${jobId}`);
      const res = await fetch(`https://e.truckyapp.com/api/v1/job/${jobId}`, {
        headers: {
            'x-access-token': process.env.TRUCKY_API_KEY,
            'Accept': 'application/json',
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
            "Referer": "https://nismara.web.id/",
            "Origin": "https://nismara.web.id",
        }
      });

      if (!res.ok) return interaction.editReply("❌ Job ID tidak ditemukan di Trucky API.");
      const job = await res.json();
      console.log(`Fetched Job Data: ${JSON.stringify(job)}`);

      // Validasi job belum selesai
      if (job.status === "completed") {
        return interaction.editReply("❌ Job ini sudah selesai, tidak bisa digunakan untuk kontrak aktif.");
      }

      // Validasi nama perusahaan
        const source = job.source_company_name || "";
        const destination = job.destination_company_name || "";
        const contractName = contract.companyName.toLowerCase();

        if (
            source.toLowerCase() !== contractName &&
            destination.toLowerCase() !== contractName
        ) {
            return interaction.editReply(
                `❌ Job ini tidak berasal **dari** atau **menuju ke** perusahaan kontrak (**${contract.companyName}**).`
            );
        }

      // Cek apakah user sudah punya job aktif
      const existing = await ActiveJob.findOne({ guildId, driverId: userId, active: true });
      if (existing)
        return interaction.editReply("⚠️ Kamu masih punya job aktif! Selesaikan dulu job sebelumnya dengan `/endjob`.");

      await ActiveJob.create({
        guildId,
        driverId: userId,
        jobId: jobId,
        companyName: source,
        source: job.source_city_name,
        destination: job.destination_city_name,
        cargo: job.cargo_name,
        cargo_mass: job.cargo_mass_t,
        distance: job.planned_distance_km,
      });

      const actualCreatedAt = Math.floor(new Date(job.created_at).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setTitle(`Special Contract Started! - Job ${jobId}`)
        .setColor("Yellow")
        .setAuthor({ 
            name: job.driver.name, 
            iconURL: job.driver.avatar_url,
            url: job.driver.public_url
        })
        .addFields(
        { name: "🚛 Driver", value: `<@${userId}>`, inline: true },
        { name: "🏢 Perusahaan", value: job.source_company_name, inline: true },
        { name: "🗺️ Rute", value: `${job.source_city_name} → ${job.destination_city_name} (${job.planned_distance_km} Km)`},
        { name: "🧾 Kargo", value: `${job.cargo_name} (${job.cargo_mass_t} t)`, inline: true },
        { name: "📆 Dimulai Pada", value: `<t:${actualCreatedAt}:f>`, inline: true },
        )
        .setURL(job.public_url)
        .setThumbnail(job.driver.avatar_url)
        .setTimestamp();

        // 🧩 Cek apakah job.vehicle ada
        if (job.vehicle) {
          embed.setFooter({
            text: `${job.vehicle_brand_name || job.vehicle.model?.brand?.name || "Unknown Brand"} - ${job.vehicle.vehicle_name || "Unknown Vehicle"}`,
            iconURL: job.vehicle.model?.brand?.logo_url || "https://i.imgur.com/FljyDVl.png",
          });
        } else {
          // fallback kalau rental / vehicle null
          embed.setFooter({
            text: `${job.vehicle_brand_name || "Rental Vehicle"} - ${job.vehicle_model_name || "No Vehicle Data"}`,
            iconURL: "https://i.imgur.com/FljyDVl.png",
          });
        }
      if (notifyChannel) await notifyChannel.send({ embeds: [embed] });

      await interaction.editReply(`✅ Job **${job.cargo_name}** dari **${source}** dimulai! Selesaikan dan akhiri dengan perintah \`/endjob\`.`);
        } catch (err) {
            console.error(err);
            await interaction.editReply("⚠️ Terjadi kesalahan saat memulai job.");
        }
    }
}).toJSON();