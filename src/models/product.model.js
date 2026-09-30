import { Schema, model } from "mongoose";

const productSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
    },

    // BULLET POINT 1–4
    bulletPoints: {
      type: [{ type: String, trim: true }],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length <= 4,
        message: "Maximum 4 bullet points allowed",
      },
    },

    shortDescription: {
      type: String,
      trim: true,
      default: "",
    },

    longDescription: {
      type: String,
      trim: true,
      default: "",
    },

    // MATERIAL 1–3
    materials: {
      type: [{ type: String, trim: true }],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length <= 3,
        message: "Maximum 3 materials allowed",
      },
    },

    packageContents: {
      type: String,
      trim: true,
      default: "",
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"],
      index: true,
    },
  },
  { timestamps: true },
);

// ========================================
// PRODUCT COLOR: color and shared images
// ========================================

const productColorSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },

    color: {
      type: String,
      required: [true, "Color is required"],
      trim: true,
      lowercase: true,
      // Examples: "black", "blue", "navy blue"
    },

    // IMAGE 1–5
    // Every size belonging to this color uses these images.
    images: {
      type: [{ type: String, trim: true }],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length <= 5,
        message: "Maximum 5 images allowed per color",
      },
    },
  },
  { timestamps: true },
);

// Prevent duplicate colors within the same product.
productColorSchema.index({ productId: 1, color: 1 }, { unique: true });

// ========================================
// PRODUCT VARIANT: one size of one color
// ========================================

const productVariantSchema = new Schema(
  {
    colorId: {
      type: Schema.Types.ObjectId,
      ref: "ProductColor",
      required: [true, "Product color reference is required"],
    },

    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    size: {
      type: String,
      required: [true, "Size is required"],
      trim: true,
      uppercase: true,
      // Examples: "S", "M", "L", "XL", "42", "FREE SIZE"
    },

    // SIZE - L / W / H: physical dimensions.
    dimensions: {
      length: {
        type: Number,
        min: 0,
        default: null,
      },

      width: {
        type: Number,
        min: 0,
        default: null,
      },

      height: {
        type: Number,
        min: 0,
        default: null,
      },
    },

    // Planning estimates from your sheet.
    // These fields are separate from the checkout price.

    estimatedCostPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    estimatedSellingPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    estimatedCostPriceOOI: {
      type: Number,
      min: 0,
      default: null,
    },

    estimatedSalePriceOOI: {
      type: Number,
      min: 0,
      default: null,
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Stock must be a safe whole number",
      },
    },
  },
  { timestamps: true },
);

// Prevent duplicate sizes within the same product color.
productVariantSchema.index({ colorId: 1, size: 1 }, { unique: true });


// category
const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      lowercase: true,
      unique: true,
    },
  },
  { timestamps: true },
);

export const Category = model("Category", categorySchema);

export const Product = model("Product", productSchema);

export const ProductColor = model("ProductColor", productColorSchema);

export const ProductVariant = model("ProductVariant", productVariantSchema);
