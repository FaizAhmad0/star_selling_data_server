import mongoose from "mongoose";

const { Schema } = mongoose;

const otpTokenSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
});

const OtpToken = mongoose.model("OtpToken", otpTokenSchema);

export default OtpToken;
