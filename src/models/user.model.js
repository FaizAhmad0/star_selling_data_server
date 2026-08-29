import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    primaryContact: {
      type: String,
    },

    email: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      select: false,
    },

    gst: {
      type: String,
    },

    role: {
      type: String,
      enum: ["user", "manager", "admin", "supervisor", "accountant"],
      required: true,
      default: "user",
    },

    // Manager references
    amazonManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    websiteManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    etsyManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    uid: {
      type: Number,
      unique: true,
    },

    dateAmazon: {
      type: String,
    },

    dateWebsite: {
      type: String,
    },

    dateEtsy: {
      type: String,
    },

    enrollmentIdAmazon: {
      type: String,
      unique: true,
    },

    enrollmentIdWebsite: {
      type: String,
      unique: true,
    },

    enrollmentIdEtsy: {
      type: String,
      unique: true,
    },

    batchAmazon: {
      type: String,
    },

    batchWebsite: {
      type: String,
    },

    batchEtsy: {
      type: String,
    },

    enrolledBy: {
      type: String,
    },

  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

export default User;
