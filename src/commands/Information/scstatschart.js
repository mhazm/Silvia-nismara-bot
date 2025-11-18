const {
    ChatInputCommandInteraction,
    AttachmentBuilder,
    ApplicationCommandOptionType
} = require("discord.js");

const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const SCH = require("../../models/specialContractHistory");

const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

// Canvas size
const width = 1200;
const height = 600;

module.exports = new ApplicationCommand({
    command: {
        name: "scstatschart",
        description: "Menampilkan grafik statistik Special Contract",
        type: 1,
        options: [
            {
                name: "type",
                description: "Jenis grafik yang ingin ditampilkan",
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: "Trend Bulanan (Per Hari)", value: "monthly" },
                    { name: "KM per Hari", value: "distance" },
                    { name: "Top 10 Driver - SC", value: "topsc" },
                    { name: "Top 10 Driver - KM", value: "topkm" },
                    { name: "Top 10 Driver - Revenue", value: "toprevenue" },
                    { name: "Top 10 Driver - Cargo Tons", value: "toptons" }
                ]
            }
        ]
    },
    options: {
        allowedRoles: ["driver"],
    },
    /**
     * @param {DiscordBot} client
     * @param {ChatInputCommandInteraction} interaction
     */
    run: async (client, interaction) => {
        await interaction.deferReply();

        const type = interaction.options.getString("type");
        const guildId = interaction.guild.id;

        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Ambil data SC bulan ini saja
        const data = await SCH.find({
            guildId,
            completedAt: { $gte: startMonth }
        });

        if (!data.length)
            return interaction.editReply("📭 Tidak ada data Special Contract bulan ini.");

        let labels = [];
        let values = [];
        let title = "SC Stats Chart";
        let color = "rgba(54, 162, 235, 0.7)";

        switch (type) {
            // ======================================================
            // TREND BULANAN — SC PER HARI
            // ======================================================
            case "monthly":
                title = "Jumlah SC per Hari";
                color = "rgba(75, 192, 192, 0.7)";

                const daysCount = data.reduce((acc, d) => {
                    const day = d.completedAt.getDate();
                    acc[day] = (acc[day] || 0) + 1;
                    return acc;
                }, {});

                labels = Object.keys(daysCount).map(Number);
                values = Object.values(daysCount);
                break;

            // ======================================================
            // TREND KM PER HARI
            // ======================================================
            case "distance":
                title = "Total KM per Hari";
                color = "rgba(255, 159, 64, 0.7)";

                const kmCount = data.reduce((acc, d) => {
                    const day = d.completedAt.getDate();
                    acc[day] = (acc[day] || 0) + d.distanceKm;
                    return acc;
                }, {});

                labels = Object.keys(kmCount).map(Number);
                values = Object.values(kmCount);
                break;

            // ======================================================
            // TOP DRIVER (SC)
            // ======================================================
            case "topsc":
                title = "Top 10 Driver — Total SC";
                color = "rgba(153, 102, 255, 0.7)";

                const topsc = await SCH.aggregate([
                    { $match: { guildId, completedAt: { $gte: startMonth } } },
                    { $group: { _id: "$driverId", total: { $sum: 1 } } },
                    { $sort: { total: -1 } },
                    { $limit: 10 }
                ]);

                labels = await Promise.all(topsc.map(async row => {
                    const m = await interaction.guild.members.fetch(row._id).catch(() => null);
                    return m ? m.displayName : "Unknown";
                }));

                values = topsc.map(r => r.total);
                break;

            // ======================================================
            // TOP KM
            // ======================================================
            case "topkm":
                title = "Top 10 Driver — Total KM";
                color = "rgba(255, 99, 132, 0.7)";

                const topkm = await SCH.aggregate([
                    { $match: { guildId, completedAt: { $gte: startMonth } } },
                    { $group: { _id: "$driverId", total: { $sum: "$distanceKm" } } },
                    { $sort: { total: -1 } },
                    { $limit: 10 }
                ]);

                labels = await Promise.all(topkm.map(async row => {
                    const m = await interaction.guild.members.fetch(row._id).catch(() => null);
                    return m ? m.displayName : "Unknown";
                }));

                values = topkm.map(r => r.total);
                break;

            // ======================================================
            // TOP REVENUE
            // ======================================================
            case "toprevenue":
                title = "Top 10 Driver — Revenue";
                color = "rgba(54, 162, 235, 0.7)";

                const toprev = await SCH.aggregate([
                    { $match: { guildId, completedAt: { $gte: startMonth } } },
                    { $group: { _id: "$driverId", total: { $sum: "$revenue" } } },
                    { $sort: { total: -1 } },
                    { $limit: 10 }
                ]);

                labels = await Promise.all(toprev.map(async row => {
                    const m = await interaction.guild.members.fetch(row._id).catch(() => null);
                    return m ? m.displayName : "Unknown";
                }));

                values = toprev.map(r => r.total);
                break;

            // ======================================================
            // TOP TONS
            // ======================================================
            case "toptons":
                title = "Top 10 Driver — Cargo Tons";
                color = "rgba(255, 205, 86, 0.7)";

                const toptons = await SCH.aggregate([
                    { $match: { guildId, completedAt: { $gte: startMonth } } },
                    { $group: { _id: "$driverId", total: { $sum: "$cargoMassTons" } } },
                    { $sort: { total: -1 } },
                    { $limit: 10 }
                ]);

                labels = await Promise.all(toptons.map(async row => {
                    const m = await interaction.guild.members.fetch(row._id).catch(() => null);
                    return m ? m.displayName : "Unknown";
                }));

                values = toptons.map(r => r.total);
                break;
        }

        // =====================================================
        //      GENERATE CHART
        // =====================================================
        const chart = new ChartJSNodeCanvas({ width, height });

        const buffer = await chart.renderToBuffer({
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: title,
                        data: values,
                        backgroundColor: color
                    }
                ]
            },
            options: {
                responsive: false,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        const attachment = new AttachmentBuilder(buffer, { name: "chart.png" });

        await interaction.editReply({
            content: `📊 **${title}**`,
            files: [attachment]
        });
    }
}).toJSON();