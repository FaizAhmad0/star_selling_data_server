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
    },

    enrollmentIdWebsite: {
      type: String,
    },

    enrollmentIdEtsy: {
      type: String,
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

    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ enrollmentIdAmazon: 1 }, { unique: true, partialFilterExpression: { enrollmentIdAmazon: { $type: "string" } } });
userSchema.index({ enrollmentIdWebsite: 1 }, { unique: true, partialFilterExpression: { enrollmentIdWebsite: { $type: "string" } } });
userSchema.index({ enrollmentIdEtsy: 1 }, { unique: true, partialFilterExpression: { enrollmentIdEtsy: { $type: "string" } } });

const User = mongoose.model("User", userSchema);

export default User;
