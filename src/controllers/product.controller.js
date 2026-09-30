import * as productService from "../services/product.service.js";
import { sendSuccess } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

export const getProducts = asyncHandler(async (req, res) => {
  const result = await productService.getProducts(req.query);
  return sendSuccess(res, { message: "Products retrieved successfully", data: result });
});

export const bulkImportProducts = asyncHandler(async (req, res) => {
  const result = await productService.bulkImportProducts(req.body.rows);
  return sendSuccess(res, {
    message: `Product import completed: ${result.created} created, ${result.updated} updated, ${result.failed.length} failed`,
    data: result,
  });
});
