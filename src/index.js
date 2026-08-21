require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');
const mongoHandler = require('./client/handler/mongoHandler');
const startEventWatcher = require('./utils/eventWatcher');
const startContractWatcher = require('./utils/contractWatcher');
const startCouponWatcher = require('./utils/couponWatcher');
const registrationWatcher = require('./utils/registrationWatcher');
const startDriverVacationWatcher = require('./utils/driverVacationWatcher');
const insuranceEvaluator = require('./utils/insuranceEvaluator');
const startInsuranceWatcher = require('./utils/insuranceWatcher');
const cargoMarketEvaluator = require('./utils/cargoMarket');
const startConvoyNotificationWatcher = require('./utils/convoyNotification');
const startNismaraPlusWatcher = require('./utils/nismaraPlusWatcher');
const startGarageWatcher = require('./utils/garageCron');
const { initLottoCron } = require('./utils/lotto');
const startAiHistoryWatcher = require('./utils/aiHistoryWatcher');
const { start } = require('repl');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();
const mongodb = mongoHandler(client);

module.exports = client;

client.connect();
startEventWatcher(client);
startContractWatcher(client);
startCouponWatcher(client);
registrationWatcher(client);
startDriverVacationWatcher(client);
startInsuranceWatcher(client);
insuranceEvaluator(client);
cargoMarketEvaluator(client);
initLottoCron(client);
startConvoyNotificationWatcher(client);
startNismaraPlusWatcher(client);
startGarageWatcher(client);
startAiHistoryWatcher(client);

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
