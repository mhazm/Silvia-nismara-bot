require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');
const mongoHandler = require('./client/handler/mongoHandler');
const startEventWatcher = require('./utils/eventWatcher');
const startContractWatcher = require('./utils/contractWatcher');
const startCouponWatcher = require('./utils/couponWatcher');
const { start } = require('repl');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();
const mongodb = mongoHandler(client);

module.exports = client;

client.connect();
startEventWatcher(client);
startContractWatcher(client);
startCouponWatcher(client);

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
