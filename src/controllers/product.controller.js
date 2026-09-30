import * as productService from "../services/product.service.js";
import { sendSuccess } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

export const bulkImportProducts = asyncHandler(async (req, res) => {
  const result = await productService.bulkImportProducts(req.body.rows);
  return sendSuccess(res, {
    message: `Product import completed: ${result.created} created, ${result.updated} updated, ${result.failed.length} failed`,
    data: result,
  });
});
