const { ChatInputCommandInteraction, ApplicationCommandOptionType, AttachmentBuilder } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const GuildSettings = require("../../models/guildsetting");

module.exports = new ApplicationCommand({
    command: {
        name: 'setlogchannel',
        description: 'Set channel discord untuk log Silvia',
        type: 1,
        options: [{
            name: 'channel',
            description: 'Pilih channel untuk log Silvia',
            type: 7, // Channel type
            required: true
        }]
    },
    options: {
        botOwner: true,
        allowedRoles: ['manager'],
    },
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        const channel = interaction.options.getChannel("channel");
        const guildId = interaction.guild.id;

        if (!channel.isTextBased()) {
        return interaction.reply({ content: "❌ Pilih channel teks.", ephemeral: true });
        }

        let setting = await GuildSettings.findOne({ guildId });
            if (!setting) {
                contract = new GuildSettings({ guildId, channelLog: channel.id });
            } else {
                setting.channelLog = channel.id;
            }

        await setting.save();
        await interaction.reply({ content: `✅ Silvia log diset ke ${channel}`, ephemeral: true});
    }
}).toJSON();