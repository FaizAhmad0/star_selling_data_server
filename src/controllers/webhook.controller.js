import User from "../models/user.model.js";
import { sendSuccess, sendError } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

const normalize = (str) =>
  String(str)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fieldMapping = {
  Date: "dateWebsite",
  "Enrollment ID": "enrollmentIdWebsite",
  "Amazon Enrolled": "amazonEnrolled",
  "Call Status": "callStatus",
  "Website Further Process": "websiteFurtherProcess",
  "Personal Informations Form": "personalInformationsForm",
  "Client Information Form": "clientInformationForm",
  "Batch Id": "batchWebsite",
  Name: "name",
  Email: "email",
  State: "state",
  GST: "haveGst",
  "GST - Number": "gst",
  "Further Procedure Recoding": "furtherProcedureRecoding",
  "Domain Name": "domainName",
  "Domain Status": "domainStatus",
  "ID Card": "idCard",
  Leegality: "leegality",
  "Performa Invoice": "performaInvoice",
  OVC: "ovc",
  "Theme - 3": "theme3",
  "Social Media - 1": "socialMedia1",
  "Banner - 50": "banner50",
  "Support Portal": "supportPortal",
  Gallery: "gallery",
  Logo: "logo",
  "Banner - 100": "banner100",
  "Server Email": "serverEmail",
  "Social Media part -2": "socialMediaPart2",
  "Category selection": "categorySelection",
  "Domain re-confirmations": "domainReconfirmations",
  "Server Mail Confirmations": "serverMailConfirmations",
  "Server Purchase": "serverPurchase",
  "Website live": "websiteLive",
  "Payments Status": "paymentsStatus",
  Handover: "handover",
  "Indian PG Status": "indianPgStatus",
  Paypal: "paypal",
  "Backend Transferred": "backendTransferred",
  "GST Invoice": "gstInvoice",
  "Leegality PDF": "leegalityPdf",
  "Website Remark": "websiteRemark",
  "Aadhar Card": "aadharCard",
  "Phone Number": "primaryContact",
  Address: "address",
};

export const googleSheetWebhook = asyncHandler(async (req, res) => {
  const { platform, enrollmentId, updatedField, editedAt } = req.body;

  if (!platform) {
    return sendError(res, { message: "Platform is required", statusCode: 400 });
  }

  if (!enrollmentId) {
    return sendError(res, { message: "Enrollment ID is required", statusCode: 400 });
  }

  if (!updatedField?.field) {
    return sendError(res, { message: "Updated field is required", statusCode: 400 });
  }

  if (platform.toLowerCase() !== "website") {
    return sendError(res, { message: "Only website platform is supported right now", statusCode: 400 });
  }

  const cleanField = normalize(updatedField.field);
  const mongoField = fieldMapping[cleanField];

  if (!mongoField) {
    return sendError(res, { message: `No mapping found for ${cleanField}`, statusCode: 400 });
  }

  const result = await User.updateOne(
    { enrollmentIdWebsite: enrollmentId },
    { $set: { [mongoField]: updatedField.value } }
  );

  if (result.matchedCount === 0) {
    return sendError(res, { message: `User not found for enrollment ${enrollmentId}`, statusCode: 404 });
  }

  console.log({
    platform,
    enrollmentId,
    cleanField,
    mongoField,
    value: updatedField.value,
    editedAt,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  });

  return sendSuccess(res, { message: "User updated successfully" });
});
