const DriverLink = require('../models/driverlink');

async function getDriverLink(guildId, userId) {
	return DriverLink.findOne({ guildId, userId }).lean();
}

module.exports = {
	getDriverLink,
};
