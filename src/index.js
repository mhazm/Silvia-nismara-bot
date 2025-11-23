require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');
const mongoHandler = require('./client/handler/mongoHandler');
const startEventWatcher = require('./utils/eventWatcher');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();
const mongodb = mongoHandler(client);

module.exports = client;

client.connect();
startEventWatcher(client);

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
