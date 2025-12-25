const mongoose = require("mongoose");

const driverLinkSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true }, // Discord user
  truckyId: { type: Number, required: true }, // Trucky User ID
  truckyName: { type: String, required: true },
  previousUserIds: {
			type: [String],
			default: [],
		},
}, { timestamps: true });

driverLinkSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports =
  mongoose.models.DriverLink ||
  mongoose.model("DriverLink", driverLinkSchema);
