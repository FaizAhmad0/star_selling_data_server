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
    address: {
      type: String,
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

    platform: {
      type: Schema.Types.ObjectId,
      ref: "Platform",
    },

    platforms: [
      {
        type: Schema.Types.ObjectId,
        ref: "Platform",
      },
    ],

    enrolledBy: {
      type: String,
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },

    // ===============================
    // Website Platform Fields
    // ===============================

    amazonEnrolled: {
      type: String,
      default: "No",
    },

    callStatus: {
      type: String,
    },

    websiteFurtherProcess: {
      type: String,
      default: "Not Sent",
    },

    personalInformationsForm: {
      type: String,
      default: "Not Sent",
    },

    clientInformationForm: {
      type: String,
      default: "Not Sent",
    },
    haveGst: {
      type: String,
      default: "NO",
    },
    furtherProcedureRecoding: {
      type: String,
      default: "Not Sent",
    },

    domainName: {
      type: String,
    },

    domainStatus: {
      type: String,
      default: "Pending",
    },

    idCard: {
      type: String,
      default: "Not Sent",
    },

    leegality: {
      type: String,
      default: "Pending",
    },

    performaInvoice: {
      type: String,
      default: "Not Sent",
    },

    ovc: {
      type: String,
      default: "Not Sent",
    },

    theme3: {
      type: String,
      default: "Not Sent",
    },

    socialMedia1: {
      type: String,
      default: "Not Sent",
    },

    banner50: {
      type: String,
      default: "Not Sent",
    },

    supportPortal: {
      type: String,
      default: "Not Sent",
    },

    gallery: {
      type: String,
      default: "Not Sent",
    },

    logo: {
      type: String,
      default: "Not Sent",
    },

    banner100: {
      type: String,
      default: "Not Sent",
    },

    serverEmail: {
      type: String,
    },

    socialMediaPart2: {
      type: String,
      default: "Not Sent",
    },

    categorySelection: {
      type: String,
      default: "Not Sent",
    },

    domainReconfirmations: {
      type: String,
    },

    serverMailConfirmations: {
      type: String,
    },

    serverPurchase: {
      type: String,
      default: "Not Done",
    },

    websiteLive: {
      type: String,
      default: "Pending",
    },

    paymentsStatus: {
      type: String,
      default: "Not Yet",
    },

    handover: {
      type: String,
      default: "Pending",
    },

    indianPgStatus: {
      type: String,
      default: "Pending",
    },

    paypal: {
      type: String,
      default: "Pending",
    },

    backendTransferred: {
      type: String,
      default: "Not Yet",
    },

    gstInvoice: {
      type: String,
    },

    leegalityPdf: {
      type: String,
    },

    websiteRemark: {
      type: String,
    },

    aadharCard: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index(
  { enrollmentIdAmazon: 1 },
  {
    unique: true,
    partialFilterExpression: { enrollmentIdAmazon: { $type: "string" } },
  },
);
userSchema.index(
  { enrollmentIdWebsite: 1 },
  {
    unique: true,
    partialFilterExpression: { enrollmentIdWebsite: { $type: "string" } },
  },
);
userSchema.index(
  { enrollmentIdEtsy: 1 },
  {
    unique: true,
    partialFilterExpression: { enrollmentIdEtsy: { $type: "string" } },
  },
);

const User = mongoose.model("User", userSchema);

export default User;
