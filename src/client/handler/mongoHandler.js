const mongoose = require('mongoose');

module.exports = async (client) => {
	mongoose.connect(process.env.MONGO_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	});

	mongoose.connection.on('connected', () => {
		console.log('✅ MongoDB connected successfully.');
	});

	mongoose.connection.on('error', (err) => {
		console.error('❌ MongoDB connection error:', err);
	});
};
