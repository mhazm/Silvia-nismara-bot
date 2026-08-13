const mongoose = require("mongoose");

const lottoPeriodSchema = new mongoose.Schema(
  {
    periodNumber: { type: Number, required: true, unique: true },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED", "DRAWN"],
      default: "OPEN",
    },
    baseJackpot: { type: Number, default: 10000 },
    accumulatedPrize: { type: Number, default: 0 },
    winningNumbers: { type: [Number], default: [] },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
  },
  { timestamps: true }
);

// Virtual field for total prize pool
lottoPeriodSchema.virtual("totalPrizePool").get(function () {
  return this.baseJackpot + this.accumulatedPrize;
});

lottoPeriodSchema.set("toJSON", { virtuals: true });
lottoPeriodSchema.set("toObject", { virtuals: true });

module.exports =
  mongoose.models.LottoPeriod ||
  mongoose.model("LottoPeriod", lottoPeriodSchema);
