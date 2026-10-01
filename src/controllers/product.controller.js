import * as productService from "../services/product.service.js";
import { sendSuccess } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

export const updateProductVariantStock = asyncHandler(async (req, res) => {
  const result = await productService.updateProductVariantStock(req.params.productId, req.params.variantId, req.body.stock);
  return sendSuccess(res, {
    message: result.variant.stock === 0 ? "Variant marked out of stock" : "Variant stock updated successfully",
    data: result,
  });
});

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
