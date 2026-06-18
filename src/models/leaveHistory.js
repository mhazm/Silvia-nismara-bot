const mongoose = require('mongoose');

const leaveHistorySchema = new mongoose.Schema(
	{
		userId: { type: String, required: true },
		truckyId: { type: String },
		startDate: { type: Date, default: Date.now },
		endDate: { type: Date },
		reason: { type: String, required: true },
		managerId: { type: String, required: true },
		managerName: { type: String },
		status: {
			type: String,
			enum: ['active', 'deactivated'],
			default: 'active',
		},
		closedAt: { type: Date },
		durationDays: { type: Number },
	},
	{ timestamps: true },
);

module.exports =
	mongoose.models.LeaveHistory ||
	mongoose.model('LeaveHistory', leaveHistorySchema);
