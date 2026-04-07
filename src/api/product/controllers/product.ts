/**
 * product controller
 */

import { factories } from "@strapi/strapi";
import crypto from "crypto";

const getAnonymousUserId = (ctx) => {
  const ip =
    ctx.request.ip || ctx.request.connection.remoteAddress || "unknown";
  const userAgent = ctx.request.headers["user-agent"] || "";
  const fingerprint = crypto
    .createHash("md5")
    .update(`${ip}-${userAgent}`)
    .digest("hex");
  return `anon_${fingerprint}`;
};
import { generateUniqueSlug } from "../../../utils/slug";
import {
  translateProductContent,
  type ContentLanguage,
} from "../../../utils/translate";
import { sanitizeProducts, sanitizeProductSeller } from "../utils/sanitizer";
import {
  calculatePricesFromCurrency,
  calculatePricesFromUSD,
} from "../utils/price";
// Функция для рекурсивного получения всех дочерних категорий
const getAllChildCategoryIds = async (strapi, categoryId) => {
  const childCategories = await strapi.entityService.findMany(
    "api::category.category",
    {
      filters: { parent: { id: { $eq: categoryId } } },
      fields: ["id"],
    }
  );

  let allChildIds = childCategories.map((cat) => cat.id);

  // Рекурсивно получаем дочерние категории для каждой найденной категории
  for (const childCategory of childCategories) {
    const grandChildIds = await getAllChildCategoryIds(
      strapi,
      childCategory.id
    );
    allChildIds = [...allChildIds, ...grandChildIds];
  }

  return allChildIds;
};


/**
 * Compute DB-based aggregations from a list of products.
 * Returns the same structure the frontend expects from Elasticsearch.
 */
function computeAggregations(products: any[]) {
  if (!products || products.length === 0) {
    return {
      priceStats: { min: 0, max: 0 },
      priceStatsByCurrency: {
        USD: { min: 0, max: 0 },
        EUR: { min: 0, max: 0 },
        UAH: { min: 0, max: 0 },
      },
      availability: [],
      condition: [],
      categories: [],
    };
  }

  // Price stats
  const usdPrices = products.map((p) => p.priceUSD).filter((v) => v != null && v > 0);
  const eurPrices = products.map((p) => p.priceEUR).filter((v) => v != null && v > 0);
  const uahPrices = products.map((p) => p.priceUAH).filter((v) => v != null && v > 0);

  const safeMin = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);
  const safeMax = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);

  // Availability (status distribution)
  const availabilityMap: Record<string, number> = {};
  for (const p of products) {
    if (p.status) availabilityMap[p.status] = (availabilityMap[p.status] || 0) + 1;
  }
  const availability = Object.entries(availabilityMap).map(([key, count]) => ({ key, count }));

  // Condition distribution
  const conditionMap: Record<string, number> = {};
  for (const p of products) {
    if (p.condition) conditionMap[p.condition] = (conditionMap[p.condition] || 0) + 1;
  }
  const condition = Object.entries(conditionMap).map(([key, count]) => ({ key, count }));

  // Category distribution
  const categoryMap: Record<string, { slug: string; name: string; count: number }> = {};
  for (const p of products) {
    if (p.category?.slug) {
      const slug = p.category.slug;
      if (!categoryMap[slug]) {
        categoryMap[slug] = { slug, name: p.category.name || slug, count: 0 };
      }
      categoryMap[slug].count++;
    }
  }
  const categories = Object.values(categoryMap);

  return {
    priceStats: { min: safeMin(usdPrices), max: safeMax(usdPrices) },
    priceStatsByCurrency: {
      USD: { min: safeMin(usdPrices), max: safeMax(usdPrices) },
      EUR: { min: safeMin(eurPrices), max: safeMax(eurPrices) },
      UAH: { min: safeMin(uahPrices), max: safeMax(uahPrices) },
    },
    availability,
    condition,
    categories,
  };
}

export default factories.createCoreController(
  "api::product.product",
  ({ strapi }) => ({
    async findPublic(ctx) {
      try {
        const { query } = ctx;

        // Try to get user from token if Authorization header is present
        // Since auth: false is set on the route, ctx.state.user won't be set automatically
        let authenticatedUser = ctx.state.user;
        if (!authenticatedUser) {
          const authHeader = ctx.request.header.authorization;
          if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7);
            try {
              // Verify token and get user
              const { id } =
                await strapi.plugins["users-permissions"].services.jwt.verify(
                  token
                );
              authenticatedUser = await strapi.entityService.findOne(
                "plugin::users-permissions.user",
                id,
                { populate: ["role"] }
              );
            } catch (error) {
              // Invalid token, ignore and continue as unauthenticated
              console.log("Token verification failed:", error.message);
            }
          }
        }

        const populate = {
          category: {
            populate: {
              parent: true,
            },
          },
          tags: true,
          seller: {
            populate: {
              metadata: {
                populate: {
                  avatar: true,
                },
              },
            },
          },
          images: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 5;

        const filters = { ...(query.filters as any) };

        // Debug: log incoming query and user state
        console.log("🔍 [findPublic] Debug info:", {
          hasUser: !!authenticatedUser,
          userId: authenticatedUser?.id,
          hasAuthHeader: !!ctx.request.header.authorization,
          authHeader: ctx.request.header.authorization
            ? ctx.request.header.authorization.substring(0, 20) + "..."
            : null,
          queryFilters: query.filters,
          filters,
          url: ctx.request.url,
        });

        // Enforce public status filter: only available products on public listing
        // Exception: if the authenticated user is the same seller being filtered,
        // show all products regardless of status (so sellers can see all their own products)
        let isSellerViewingOwnProducts = false;
        if (authenticatedUser && filters.seller) {
          const currentUserId = Number(authenticatedUser.id);
          let sellerId: number | undefined;

          // Handle different filter formats: filters.seller.$eq or filters.seller directly
          if (filters.seller.$eq !== undefined) {
            sellerId = Number(filters.seller.$eq);
          } else if (typeof filters.seller === "number") {
            sellerId = filters.seller;
          } else if (typeof filters.seller === "string") {
            sellerId = Number(filters.seller);
          }

          isSellerViewingOwnProducts =
            sellerId !== undefined &&
            !isNaN(sellerId) &&
            sellerId === currentUserId;

          // Debug logging
          console.log("🔍 [findPublic] Product filter check:", {
            hasUser: !!authenticatedUser,
            currentUserId,
            filtersSeller: filters.seller,
            sellerId,
            isSellerViewingOwnProducts,
            filtersSellerType: typeof filters.seller,
            filtersSellerKeys: filters.seller
              ? Object.keys(filters.seller)
              : [],
            match: sellerId === currentUserId,
          });
        } else {
          console.log("🔍 [findPublic] Product filter check skipped:", {
            hasUser: !!authenticatedUser,
            hasSellerFilter: !!filters.seller,
            authenticatedUserId: authenticatedUser?.id,
          });
        }

        // If seller is viewing own products, remove any status filter
        if (isSellerViewingOwnProducts) {
          delete filters.status;
          console.log(
            "✅ [findPublic] Removed status filter for seller viewing own products"
          );
        } else if (!filters.status) {
          (filters as any).status = { $eq: "available" };
          console.log(
            "⚠️ [findPublic] Applying status filter: available (seller NOT viewing own products)"
          );
        } else {
          console.log(
            "ℹ️ [findPublic] Status filter already present:",
            filters.status
          );
        }

        // Always exclude archived products unless seller is viewing own products
        // Override any activityStatus filter from query to prevent showing archived products
        if (!isSellerViewingOwnProducts) {
          (filters as any).activityStatus = { $ne: "archived" };
          console.log("Applying activityStatus filter: excluding archived");
        } else {
          // If seller is viewing own products, allow them to see archived products
          // Remove activityStatus filter if it was set to exclude archived
          if ((filters as any).activityStatus?.$ne === "archived") {
            delete (filters as any).activityStatus;
          }
        }

        console.log(
          "📋 [findPublic] Final filters:",
          JSON.stringify(filters, null, 2)
        );

        // Handle category slug filter
        if ((query.filters as any)?.categorySlug) {
          const categorySlug = (query.filters as any).categorySlug;
          const category = await strapi.entityService.findMany(
            "api::category.category",
            {
              filters: { slug: categorySlug },
            }
          );

          if (category && category.length > 0) {
            const mainCategoryId = category[0].id;

            // Получаем все дочерние категории рекурсивно
            const childCategoryIds = await getAllChildCategoryIds(
              strapi,
              mainCategoryId
            );

            // Создаем массив всех ID категорий (основная + дочерние)
            const allCategoryIds = [mainCategoryId, ...childCategoryIds];

            // Фильтруем продукты по всем категориям
            filters.category = { id: { $in: allCategoryIds } };
          } else {
            // If category not found, return empty results
            return ctx.send({
              data: [],
              meta: {
                pagination: {
                  page: 1,
                  pageSize: pageSize,
                  pageCount: 0,
                  total: 0,
                },
              },
            });
          }
          delete filters.categorySlug;
        }

        if ((query.filters as any)?.priceRange) {
          const priceRange = (query.filters as any).priceRange;
          if (priceRange.min !== undefined) {
            filters.price = { ...filters.price, $gte: priceRange.min };
          }
          if (priceRange.max !== undefined) {
            filters.price = { ...filters.price, $lte: priceRange.max };
          }
          delete filters.priceRange;
        }

        // Handle ID filter with $in operator and maintain order
        let productIds: number[] | undefined;
        if (filters.id && (filters.id as any).$in) {
          const idsIn = (filters.id as any).$in;
          // Handle both array and single value
          productIds = Array.isArray(idsIn)
            ? idsIn.map((id: any) => Number(id))
            : [Number(idsIn)];
        }

        const totalCount = await strapi.entityService.count(
          "api::product.product",
          {
            filters,
          }
        );

        console.log("Product count with filters:", totalCount);

        // Parse sort parameter - support both string "field:order" and array format
        let sortParam: any = undefined;
        if (!productIds && query.sort) {
          if (typeof query.sort === "string") {
            // Parse string format "field:order" to array format [{field: "order"}]
            const [field, order] = query.sort.split(":");
            if (field && order) {
              sortParam = [{ [field]: order }];
            }
          } else {
            sortParam = query.sort;
          }
        }

        // If filtering by IDs, get all matching products first (no pagination), then sort
        let products = await strapi.entityService.findMany(
          "api::product.product",
          {
            filters,
            sort: sortParam, // Use parsed sort parameter
            populate,
            start: productIds ? 0 : (page - 1) * pageSize,
            limit: productIds ? undefined : pageSize, // Get all if filtering by IDs
          }
        );

        // If filtering by IDs, maintain the order from the IDs array
        let finalTotalCount = totalCount;
        if (productIds && productIds.length > 0) {
          const productMap = new Map(products.map((p: any) => [p.id, p]));
          // Maintain the order from the IDs array (only include products that were found)
          const orderedProducts = productIds
            .map((id) => productMap.get(id))
            .filter((p): p is any => p !== undefined);

          // Update total count to actual number of found products
          finalTotalCount = orderedProducts.length;

          // Apply pagination after ordering
          const start = (page - 1) * pageSize;
          products = orderedProducts.slice(start, start + pageSize);
        }

        console.log(
          `📦 [findPublic] Products returned: ${products.length} of ${finalTotalCount} total`
        );
        console.log(
          "📦 [findPublic] Product statuses:",
          products.map((p) => ({
            id: p.id,
            status: p.status,
            activityStatus: (p as any).activityStatus,
            title: p.title,
          }))
        );

        const pageCount = Math.ceil(finalTotalCount / pageSize);

        // Sanitize seller fields in products
        const sanitizedProducts = sanitizeProducts(products);

        return ctx.send({
          data: sanitizedProducts,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount,
              total: finalTotalCount,
            },
          },
        });
      } catch (error) {
        console.error("Error fetching public products:", error);
        return ctx.internalServerError("Failed to fetch products");
      }
    },

    async findOnePublic(ctx) {
      try {
        const { id } = ctx.params;

        const product = await strapi.entityService.findOne(
          "api::product.product",
          id,
          {
            populate: {
              category: {
                populate: {
                  parent: true,
                },
              },
              tags: true,
              seller: {
                populate: {
                  metadata: {
                    populate: {
                      avatar: true,
                    },
                  },
                },
              },
              images: true,
            },
          }
        );

        if (!product) {
          return ctx.notFound("Product not found");
        }

        // Check if product is archived - if yes, only creator can view it
        if (product.activityStatus === "archived") {
          // Try to get authenticated user
          let authenticatedUser = ctx.state.user;
          if (!authenticatedUser) {
            const authHeader = ctx.request.header.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
              const token = authHeader.substring(7);
              try {
                const { id } =
                  await strapi.plugins["users-permissions"].services.jwt.verify(
                    token
                  );
                authenticatedUser = await strapi.entityService.findOne(
                  "plugin::users-permissions.user",
                  id,
                  { populate: ["role"] }
                );
              } catch (error) {
                // Invalid token, ignore
              }
            }
          }

          // Check if user is the product creator
          const isCreator =
            authenticatedUser &&
            (product as any).seller &&
            Number(authenticatedUser.id) === Number((product as any).seller.id);

          if (!isCreator) {
            return ctx.notFound("Product not found");
          }
        }

        // Трекинг просмотров для публичных пользователей
        try {
          const userId = getAnonymousUserId(ctx);

          console.log("=== PUBLIC VIEW TRACKING START ===");
          console.log("Creating view for product:", id, "user:", userId);

          const existingView = await strapi.entityService.findMany(
            "api::view.view",
            {
              filters: {
                userId: userId.toString(),
                productId: id,
              },
              limit: 1,
            }
          );

          let isNewView = false;
          if (!existingView || existingView.length === 0) {
            await strapi.entityService.create("api::view.view", {
              data: {
                userId: userId.toString(),
                productId: id,
                publishedAt: new Date(),
              },
            });
            isNewView = true;
            console.log("New view created for user:", userId, "product:", id);
          } else {
            console.log(
              "View already exists for user:",
              userId,
              "product:",
              id
            );
          }

          if (isNewView) {
            const freshProduct = await strapi.entityService.findOne(
              "api::product.product",
              id,
              {
                fields: ["viewsCount"],
              }
            );

            const currentViewsCount = Number(freshProduct?.viewsCount) || 0;
            const newViewsCount = currentViewsCount + 1;

            console.log("Current viewsCount from DB:", currentViewsCount);
            console.log("Updating viewsCount to:", newViewsCount);

            await strapi.entityService.update("api::product.product", id, {
              data: {
                viewsCount: newViewsCount,
              },
            });

            (product as any).viewsCount = newViewsCount;
            console.log(
              "Product viewsCount updated successfully to:",
              newViewsCount
            );
          } else {
            console.log(
              "Product viewsCount not updated (view already existed)"
            );
          }
        } catch (viewError) {
          console.error("Error tracking public view:", viewError);
          console.error("View error details:", {
            message: viewError.message,
            stack: viewError.stack,
          });
        }

        console.log("=== PUBLIC VIEW TRACKING END ===");

        // Sanitize seller fields
        const sanitizedProduct = sanitizeProductSeller(product);

        return ctx.send(sanitizedProduct);
      } catch (error) {
        console.error("Error fetching public product:", error);
        return ctx.internalServerError("Failed to fetch product");
      }
    },
    async create(ctx) {
      try {
        console.log("=== PRODUCT CREATE CONTROLLER START ===");
        console.log("Request URL:", ctx.request.url);
        console.log("Request method:", ctx.request.method);
        console.log("Request headers:", ctx.request.headers);
        console.log("Request body:", JSON.stringify(ctx.request.body, null, 2));
        console.log("User:", ctx.state.user);

        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to create a product"
          );
        }

        let data;
        if (ctx.request.body.data) {
          data =
            typeof ctx.request.body.data === "string"
              ? JSON.parse(ctx.request.body.data)
              : ctx.request.body.data;
        } else {
          data = ctx.request.body;
        }

        // Log original data (reduced logging for performance)

        // Handle admin panel format for relations
        if (
          data.category &&
          typeof data.category === "object" &&
          data.category.connect
        ) {
          console.log("Converting category from admin format:", data.category);
          data.category = data.category.connect[0].id;
          console.log("Converted category to:", data.category);
        }

        if (
          data.seller &&
          typeof data.seller === "object" &&
          data.seller.connect
        ) {
          console.log("Converting seller from admin format:", data.seller);
          data.seller = data.seller.connect[0].id;
          console.log("Converted seller to:", data.seller);
        }

        // Handle tags relation if it exists
        if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
          if (
            data.tags[0] &&
            typeof data.tags[0] === "object" &&
            data.tags[0].connect
          ) {
            console.log("Converting tags from admin format:", data.tags);
            data.tags = data.tags.map((tag) => tag.connect[0].id);
            console.log("Converted tags to:", data.tags);
          }
        }

        // Remove null values that might cause validation issues
        const cleanedData = Object.fromEntries(
          Object.entries(data).filter(([_, value]) => value !== null)
        );

        console.log("Cleaned data:", JSON.stringify(cleanedData, null, 2));

        // Handle status field - ensure it's a string
        if (cleanedData.status) {
          console.log(
            "Processing status field:",
            cleanedData.status,
            "Type:",
            typeof cleanedData.status
          );

          if (
            typeof cleanedData.status === "object" &&
            cleanedData.status !== null
          ) {
            console.log(
              "Status is an object, extracting value:",
              cleanedData.status
            );
            // If status comes as an object, try to extract the value
            const statusObj = cleanedData.status as any;
            if (statusObj.value) {
              cleanedData.status = statusObj.value;
            } else if (statusObj.label) {
              cleanedData.status = statusObj.label;
            } else {
              console.log(
                "Could not extract status from object, setting default"
              );
              cleanedData.status = "available";
            }
          } else if (Array.isArray(cleanedData.status)) {
            console.log(
              "Status is an array, taking first element:",
              cleanedData.status
            );
            cleanedData.status = cleanedData.status[0];
          }

          // Convert to string and trim
          cleanedData.status = String(cleanedData.status).trim();
          console.log("Processed status:", cleanedData.status);
        }

        // Ensure status is valid
        const validStatuses = ["available", "unavailable"];
        if (
          cleanedData.status &&
          !validStatuses.includes(String(cleanedData.status))
        ) {
          console.log(
            "Invalid status provided:",
            cleanedData.status,
            "Type:",
            typeof cleanedData.status
          );
          return ctx.badRequest(
            `Invalid status. Must be one of: ${validStatuses.join(", ")}`
          );
        }

        // Set default status if not provided or invalid
        if (!cleanedData.status) {
          cleanedData.status = "available";
          console.log("Setting default status to 'available'");
        }

        console.log(
          "Final status value:",
          cleanedData.status,
          "Type:",
          typeof cleanedData.status
        );

        // Force status to be a valid string
        if (cleanedData.status) {
          cleanedData.status = String(cleanedData.status).trim().toLowerCase();
        }

        // Auto-calculate prices in all currencies from the provided currency
        // Support both new format (price + currency) and legacy format (priceUSD)
        if (
          cleanedData.price !== undefined &&
          cleanedData.currency !== undefined
        ) {
          // New format: price + currency
          await calculatePricesFromCurrency(
            strapi,
            cleanedData.price as number | string | undefined | null,
            cleanedData.currency as string | undefined | null,
            cleanedData
          );
          // Remove price and currency from data as they are not stored in DB
          delete cleanedData.price;
          delete cleanedData.currency;
        } else if (cleanedData.priceUSD !== undefined) {
          // Legacy format: priceUSD (for backward compatibility)
          await calculatePricesFromUSD(
            strapi,
            cleanedData.priceUSD as number | string | undefined | null,
            cleanedData
          );
        }

        const productData: any = {
          ...cleanedData,
          seller: ctx.state.user.id,
          publishedAt: new Date(), // Автоматически публикуем продукт
        };

        console.log(
          "Final product data:",
          JSON.stringify(productData, null, 2)
        );

        if (!productData.title) {
          return ctx.badRequest("Title is required");
        }

        if (!productData.category) {
          return ctx.badRequest("Category is required");
        }

        // Set default status if not provided
        if (!productData.status) {
          productData.status = "available";
        }

        if (!productData.slug) {
          productData.slug = await generateUniqueSlug(
            strapi,
            productData.title
          );
        }

        // Translate title/description to the other locale (UA <-> EN)
        const contentLanguage: ContentLanguage =
          productData.contentLanguage === "en" ? "en" : "ua";
        if (contentLanguage === "ua") {
          productData.titleUa = productData.title;
          if (productData.description != null)
            productData.descriptionUa = productData.description;
          const translated = await translateProductContent(
            productData.title,
            productData.description,
            "en"
          );
          if (translated.title) productData.titleEn = translated.title;
          if (translated.description != null)
            productData.descriptionEn = translated.description;
        } else {
          productData.titleEn = productData.title;
          if (productData.description != null)
            productData.descriptionEn = productData.description;
          const translated = await translateProductContent(
            productData.title,
            productData.description,
            "ua"
          );
          if (translated.title) productData.titleUa = translated.title;
          if (translated.description != null)
            productData.descriptionUa = translated.description;
        }
        productData.contentLanguage = contentLanguage;

        const createOptions: any = {
          data: productData,
          populate: {
            category: {
              populate: {
                parent: true,
              },
            },
            tags: true,
            seller: {
              populate: {
                metadata: {
                  populate: {
                    avatar: true,
                  },
                },
              },
            },
            images: true,
          },
        };

        const product = await strapi.entityService.create(
          "api::product.product",
          createOptions
        );

        if (ctx.request.files && ctx.request.files["files.images"]) {
          const files = ctx.request.files["files.images"];
          const filesArray = Array.isArray(files) ? files : [files];

          // Upload images in parallel for better performance
          const uploadPromises = filesArray.map((file) =>
            strapi.plugins.upload.services.upload.upload({
              data: {
                refId: product.id,
                ref: "api::product.product",
                field: "images",
              },
              files: file,
            })
          );

          const uploadedFiles = await Promise.all(uploadPromises);
          const fileIds = uploadedFiles.flat().map((file) => file.id);

          if (fileIds.length > 0) {
            await strapi.entityService.update(
              "api::product.product",
              product.id,
              {
                data: {
                  images: fileIds,
                },
              }
            );
          }
        }

        console.log("=== PRODUCT CREATE CONTROLLER SUCCESS ===");

        // Sanitize seller fields
        const sanitizedProduct = sanitizeProductSeller(product);

        return ctx.created(sanitizedProduct);
      } catch (error) {
        console.log("=== PRODUCT CREATE CONTROLLER ERROR ===");
        console.error("Error creating product:", error);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        console.error("Error details:", error.details);
        return ctx.internalServerError("Failed to create product");
      }
    },

    async find(ctx) {
      try {
        const { query } = ctx;

        const populate = {
          category: {
            populate: {
              parent: true,
            },
          },
          tags: true,
          seller: {
            populate: {
              metadata: {
                populate: {
                  avatar: true,
                },
              },
            },
          },
          images: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 5;

        const filters = { ...(query.filters as any) };

        // Exclude archived products unless user is viewing their own products
        const currentUserId = ctx.state.user?.id;
        const isViewingOwnProducts =
          currentUserId &&
          filters.seller &&
          (Number(filters.seller) === Number(currentUserId) ||
            Number((filters.seller as any).$eq) === Number(currentUserId));

        if (!isViewingOwnProducts) {
          (filters as any).activityStatus = { $ne: "archived" };
        }

        // Handle category slug filter for authenticated users
        if ((query.filters as any)?.categorySlug) {
          const categorySlug = (query.filters as any).categorySlug;
          const category = await strapi.entityService.findMany(
            "api::category.category",
            {
              filters: { slug: categorySlug },
            }
          );

          if (category && category.length > 0) {
            const mainCategoryId = category[0].id;

            // Получаем все дочерние категории рекурсивно
            const childCategoryIds = await getAllChildCategoryIds(
              strapi,
              mainCategoryId
            );

            // Создаем массив всех ID категорий (основная + дочерние)
            const allCategoryIds = [mainCategoryId, ...childCategoryIds];

            // Фильтруем продукты по всем категориям
            filters.category = { id: { $in: allCategoryIds } };
          } else {
            // If category not found, return empty results
            return ctx.send({
              data: [],
              meta: {
                pagination: {
                  page: 1,
                  pageSize: pageSize,
                  pageCount: 0,
                  total: 0,
                },
              },
            });
          }
          delete filters.categorySlug;
        }

        if ((query.filters as any)?.priceRange) {
          const priceRange = (query.filters as any).priceRange;
          if (priceRange.min !== undefined) {
            filters.price = { ...filters.price, $gte: priceRange.min };
          }
          if (priceRange.max !== undefined) {
            filters.price = { ...filters.price, $lte: priceRange.max };
          }
          delete filters.priceRange;
        }

        const totalCount = await strapi.entityService.count(
          "api::product.product",
          {
            filters,
          }
        );

        const products = await strapi.entityService.findMany(
          "api::product.product",
          {
            filters,
            sort: query.sort,
            populate,
            start: (page - 1) * pageSize,
            limit: pageSize,
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);

        // Sanitize seller fields in products
        const sanitizedProducts = sanitizeProducts(products);

        return ctx.send({
          data: sanitizedProducts,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount,
              total: totalCount,
            },
          },
        });
      } catch (error) {
        console.error("Error fetching products:", error);
        return ctx.internalServerError("Failed to fetch products");
      }
    },

    async findOne(ctx) {
      try {
        const { id } = ctx.params;

        const product = await strapi.entityService.findOne(
          "api::product.product",
          id,
          {
            populate: {
              category: {
                populate: {
                  parent: true,
                },
              },
              tags: true,
              seller: {
                populate: {
                  metadata: {
                    populate: {
                      avatar: true,
                    },
                  },
                },
              },
              images: true,
            },
          }
        );

        if (!product) {
          return ctx.notFound("Product not found");
        }

        // Check if product is archived - if yes, only creator can view it
        if ((product as any).activityStatus === "archived") {
          const currentUserId = ctx.state.user?.id;
          const isCreator =
            currentUserId &&
            (product as any).seller &&
            Number(currentUserId) === Number((product as any).seller.id);

          if (!isCreator) {
            return ctx.notFound("Product not found");
          }
        }

        try {
          const userId = ctx.state.user?.id || getAnonymousUserId(ctx);

          console.log("=== VIEW TRACKING START ===");
          console.log("Creating view for product:", id, "user:", userId);

          const existingView = await strapi.entityService.findMany(
            "api::view.view",
            {
              filters: {
                userId: userId.toString(),
                productId: id,
              },
              limit: 1,
            }
          );

          let isNewView = false;
          if (!existingView || existingView.length === 0) {
            await strapi.entityService.create("api::view.view", {
              data: {
                userId: userId.toString(),
                productId: id,
                publishedAt: new Date(),
              },
            });
            isNewView = true;
            console.log("New view created for user:", userId, "product:", id);
          } else {
            console.log(
              "View already exists for user:",
              userId,
              "product:",
              id
            );
          }

          if (isNewView) {
            const freshProduct = await strapi.entityService.findOne(
              "api::product.product",
              id,
              {
                fields: ["viewsCount"],
              }
            );

            const currentViewsCount = Number(freshProduct?.viewsCount) || 0;
            const newViewsCount = currentViewsCount + 1;

            console.log("Current viewsCount from DB:", currentViewsCount);
            console.log("Updating viewsCount to:", newViewsCount);

            await strapi.entityService.update("api::product.product", id, {
              data: {
                viewsCount: newViewsCount,
              },
            });

            (product as any).viewsCount = newViewsCount;
            console.log(
              "Product viewsCount updated successfully to:",
              newViewsCount
            );
          } else {
            console.log(
              "Product viewsCount not updated (view already existed)"
            );
          }
        } catch (viewError) {
          console.error("Error tracking view:", viewError);
          console.error("View error details:", {
            message: viewError.message,
            stack: viewError.stack,
          });
        }

        console.log("=== VIEW TRACKING END ===");

        // Sanitize seller fields
        const sanitizedProduct = sanitizeProductSeller(product);

        return ctx.send(sanitizedProduct);
      } catch (error) {
        console.error("Error fetching product:", error);
        return ctx.internalServerError("Failed to fetch product");
      }
    },

    async update(ctx) {
      try {
        const { id } = ctx.params;

        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to update a product"
          );
        }

        let data;
        if (ctx.request.body.data) {
          data =
            typeof ctx.request.body.data === "string"
              ? JSON.parse(ctx.request.body.data)
              : ctx.request.body.data;
        } else {
          data = ctx.request.body;
        }

        // Handle admin panel format for relations
        if (
          data.category &&
          typeof data.category === "object" &&
          data.category.connect
        ) {
          data.category = data.category.connect[0].id;
        }

        if (
          data.seller &&
          typeof data.seller === "object" &&
          data.seller.connect
        ) {
          data.seller = data.seller.connect[0].id;
        }

        // Remove null values that might cause validation issues
        data = Object.fromEntries(
          Object.entries(data).filter(([_, value]) => value !== null)
        );

        console.log("Update product data:", data);
        console.log("Update files:", ctx.request.files);

        const productId = Number(id);

        const existingProduct = await strapi.entityService.findOne(
          "api::product.product",
          productId,
          {
            populate: {
              seller: true,
            },
          }
        );

        if (!existingProduct) {
          return ctx.notFound("Product not found");
        }

        const productSellerId = Number((existingProduct as any).seller?.id);
        const currentUserId = Number(ctx.state.user.id);

        if (productSellerId !== currentUserId) {
          return ctx.forbidden("You can only update your own products");
        }
        console.log("data", data);
        // Validate status field if provided
        if (data.status) {
          const validStatuses = ["available", "unavailable"];
          if (!validStatuses.includes(data.status)) {
            return ctx.badRequest(
              `Invalid status. Must be one of: ${validStatuses.join(", ")}`
            );
          }
        }

        if (data.title && data.title !== (existingProduct as any).title) {
          data.slug = await generateUniqueSlug(strapi, data.title, productId);
        }

        // Auto-calculate prices in all currencies from the provided currency
        // Support both new format (price + currency) and legacy format (priceUSD)
        if (data.price !== undefined && data.currency !== undefined) {
          // New format: price + currency
          await calculatePricesFromCurrency(
            strapi,
            data.price as number | string | undefined | null,
            data.currency as string | undefined | null,
            data
          );
          // Remove price and currency from data as they are not stored in DB
          delete data.price;
          delete data.currency;
        } else if (data.priceUSD !== undefined) {
          // Legacy format: priceUSD (for backward compatibility)
          await calculatePricesFromUSD(strapi, data.priceUSD, data);
        }

        // Re-translate title/description when they are updated
        const titleChanged =
          data.title != null && data.title !== (existingProduct as any).title;
        const descriptionChanged =
          data.description != null &&
          data.description !== (existingProduct as any).description;
        if (titleChanged || descriptionChanged) {
          const contentLang: ContentLanguage =
            (existingProduct as any).contentLanguage === "en" ? "en" : "ua";
          const titleToTranslate = data.title ?? (existingProduct as any).title;
          const descToTranslate =
            data.description != null
              ? data.description
              : (existingProduct as any).description;
          if (contentLang === "ua") {
            data.titleUa = titleToTranslate;
            if (descToTranslate != null) data.descriptionUa = descToTranslate;
            const translated = await translateProductContent(
              titleToTranslate,
              descToTranslate ?? undefined,
              "en"
            );
            if (translated.title) data.titleEn = translated.title;
            if (translated.description != null)
              data.descriptionEn = translated.description;
          } else {
            data.titleEn = titleToTranslate;
            if (descToTranslate != null) data.descriptionEn = descToTranslate;
            const translated = await translateProductContent(
              titleToTranslate,
              descToTranslate ?? undefined,
              "ua"
            );
            if (translated.title) data.titleUa = translated.title;
            if (translated.description != null)
              data.descriptionUa = translated.description;
          }
        }

        const updateOptions: any = {
          data,
          populate: {
            category: {
              populate: {
                parent: true,
              },
            },
            tags: true,
            seller: {
              populate: {
                metadata: {
                  populate: {
                    avatar: true,
                  },
                },
              },
            },
            images: true,
          },
        };

        if (ctx.request.files && ctx.request.files["files.images"]) {
          updateOptions.files = {
            images: ctx.request.files["files.images"],
          };
        }

        const product = await strapi.entityService.update(
          "api::product.product",
          productId,
          updateOptions
        );

        // Sanitize seller fields
        const sanitizedProduct = sanitizeProductSeller(product);

        return ctx.send(sanitizedProduct);
      } catch (error) {
        console.error("Error updating product:", error);
        return ctx.internalServerError("Failed to update product");
      }
    },

    async delete(ctx) {
      try {
        const { id } = ctx.params;

        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to delete a product"
          );
        }

        const existingProduct = await strapi.entityService.findOne(
          "api::product.product",
          id,
          {
            populate: {
              seller: {
                populate: {
                  metadata: {
                    populate: {
                      avatar: true,
                    },
                  },
                },
              },
            },
          }
        );

        if (!existingProduct) {
          return ctx.notFound("Product not found");
        }

        if ((existingProduct as any).seller?.id !== ctx.state.user.id) {
          return ctx.forbidden("You can only delete your own products");
        }

        await strapi.entityService.delete("api::product.product", id);

        return ctx.send({ message: "Product deleted successfully" });
      } catch (error) {
        console.error("Error deleting product:", error);
        return ctx.internalServerError("Failed to delete product");
      }
    },

    async search(ctx) {
      try {
        const { query } = ctx;
        const searchTerm = query.search as string;

        if (!searchTerm || searchTerm.trim().length === 0) {
          return ctx.badRequest("Search term is required");
        }

        const populate = {
          category: {
            populate: {
              parent: true,
            },
          },
          tags: true,
          seller: {
            populate: {
              metadata: {
                populate: {
                  avatar: true,
                },
              },
            },
          },
          images: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 10;

        // Создаем фильтры для поиска только по продуктам
        const filters: any = {
          $or: [
            // Поиск по названию продукта
            {
              title: {
                $containsi: searchTerm.trim(),
              },
            },
            // Поиск по описанию продукта
            {
              description: {
                $containsi: searchTerm.trim(),
              },
            },
          ],
          activityStatus: {
            $ne: "archived",
          },
        };

        // Добавляем дополнительные фильтры если они есть
        if ((query.filters as any)?.categorySlug) {
          const categorySlug = (query.filters as any).categorySlug;
          const category = await strapi.entityService.findMany(
            "api::category.category",
            {
              filters: { slug: categorySlug },
            }
          );

          if (category && category.length > 0) {
            const mainCategoryId = category[0].id;
            const childCategoryIds = await getAllChildCategoryIds(
              strapi,
              mainCategoryId
            );
            const allCategoryIds = [mainCategoryId, ...childCategoryIds];
            filters.category = { id: { $in: allCategoryIds } };
          }
        }

        if ((query.filters as any)?.priceRange) {
          const priceRange = (query.filters as any).priceRange;
          if (priceRange.min !== undefined) {
            filters.price = { ...filters.price, $gte: priceRange.min };
          }
          if (priceRange.max !== undefined) {
            filters.price = { ...filters.price, $lte: priceRange.max };
          }
        }

        const totalCount = await strapi.entityService.count(
          "api::product.product",
          {
            filters,
          }
        );

        const products = await strapi.entityService.findMany(
          "api::product.product",
          {
            filters,
            sort: query.sort || [{ createdAt: "desc" }],
            populate,
            start: (page - 1) * pageSize,
            limit: pageSize,
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);

        // Sanitize seller fields in products
        const sanitizedProducts = sanitizeProducts(products);

        return ctx.send({
          data: sanitizedProducts,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount,
              total: totalCount,
            },
            searchTerm: searchTerm.trim(),
          },
        });
      } catch (error) {
        console.error("Error searching products:", error);
        return ctx.internalServerError("Failed to search products");
      }
    },

    async searchPublic(ctx) {
      try {
        const { query } = ctx;
        const searchTerm = query.search as string;

        if (!searchTerm || searchTerm.trim().length === 0) {
          return ctx.badRequest("Search term is required");
        }

        const populate = {
          category: {
            populate: {
              parent: true,
            },
          },
          tags: true,
          seller: {
            populate: {
              metadata: {
                populate: {
                  avatar: true,
                },
              },
            },
          },
          images: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 10;

        // Создаем фильтры для поиска только по продуктам
        const filters: any = {
          $or: [
            // Поиск по названию продукта
            {
              title: {
                $containsi: searchTerm.trim(),
              },
            },
            // Поиск по описанию продукта
            {
              description: {
                $containsi: searchTerm.trim(),
              },
            },
          ],
        };

        // Enforce public status filter: only available products for public search
        (filters as any).status = { $eq: "available" };
        (filters as any).activityStatus = { $ne: "archived" };

        // Добавляем дополнительные фильтры если они есть
        if ((query.filters as any)?.categorySlug) {
          const categorySlug = (query.filters as any).categorySlug;
          const category = await strapi.entityService.findMany(
            "api::category.category",
            {
              filters: { slug: categorySlug },
            }
          );

          if (category && category.length > 0) {
            const mainCategoryId = category[0].id;
            const childCategoryIds = await getAllChildCategoryIds(
              strapi,
              mainCategoryId
            );
            const allCategoryIds = [mainCategoryId, ...childCategoryIds];
            filters.category = { id: { $in: allCategoryIds } };
          }
        }

        if ((query.filters as any)?.priceRange) {
          const priceRange = (query.filters as any).priceRange;
          if (priceRange.min !== undefined) {
            filters.price = { ...filters.price, $gte: priceRange.min };
          }
          if (priceRange.max !== undefined) {
            filters.price = { ...filters.price, $lte: priceRange.max };
          }
        }

        const totalCount = await strapi.entityService.count(
          "api::product.product",
          {
            filters,
          }
        );

        const products = await strapi.entityService.findMany(
          "api::product.product",
          {
            filters,
            sort: query.sort || [{ createdAt: "desc" }],
            populate,
            start: (page - 1) * pageSize,
            limit: pageSize,
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);

        // Sanitize seller fields in products
        const sanitizedProducts = sanitizeProducts(products);

        return ctx.send({
          data: sanitizedProducts,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount,
              total: totalCount,
            },
            searchTerm: searchTerm.trim(),
          },
        });
      } catch (error) {
        console.error("Error searching public products:", error);
        return ctx.internalServerError("Failed to search products");
      }
    },

    // Search seller products (DB-based)
    async searchSellerProducts(ctx) {
      try {
        const { query, params } = ctx;
        const {
          search = "",
          priceRange,
          sort = "createdAt:desc",
          page = 1,
          pageSize = 10,
          availability,
          condition,
          categories,
          currency = "USD",
        } = query;
        const { sellerId } = params;

        const populate = {
          category: { populate: { parent: true } },
          tags: true,
          seller: { populate: { metadata: { populate: { avatar: true } } } },
          images: true,
        };

        const pageNum = Number(page);
        const pageSizeNum = Number(pageSize);

        const filters: any = {
          seller: { $eq: Number(sellerId) },
          activityStatus: { $ne: "archived" },
        };

        // Availability filter
        const availabilityArr = availability
          ? Array.isArray(availability) ? availability : [availability]
          : undefined;
        if (availabilityArr && availabilityArr.length > 0) {
          filters.status = { $in: availabilityArr };
        } else {
          filters.status = { $eq: "available" };
        }

        // Condition filter
        const conditionArr = condition
          ? Array.isArray(condition) ? condition : [condition]
          : undefined;
        if (conditionArr && conditionArr.length > 0) {
          filters.condition = { $in: conditionArr };
        }

        // Category slugs filter
        const categoriesArr = categories
          ? Array.isArray(categories) ? categories : [categories]
          : undefined;
        if (categoriesArr && categoriesArr.length > 0) {
          const cats = await strapi.entityService.findMany("api::category.category", {
            filters: { slug: { $in: categoriesArr } },
            fields: ["id"],
          });
          if (cats && cats.length > 0) {
            filters.category = { id: { $in: cats.map((c: any) => c.id) } };
          }
        }

        // Text search filter
        const searchTerm = (search as string).trim();
        if (searchTerm) {
          filters.$or = [
            { title: { $containsi: searchTerm } },
            { description: { $containsi: searchTerm } },
          ];
        }

        // Price range filter (use currency-specific field)
        if (priceRange) {
          const pr = typeof priceRange === "string" ? JSON.parse(priceRange) : priceRange;
          const priceField = currency === "EUR" ? "priceEUR" : currency === "UAH" ? "priceUAH" : "priceUSD";
          if (pr.min !== undefined) filters[priceField] = { ...filters[priceField], $gte: pr.min };
          if (pr.max !== undefined) filters[priceField] = { ...filters[priceField], $lte: pr.max };
        }

        // Parse sort
        let sortParam: any = [{ createdAt: "desc" }];
        if (sort && typeof sort === "string") {
          const [field, order] = (sort as string).split(":");
          if (field && order) sortParam = [{ [field]: order }];
        }

        const totalCount = await strapi.entityService.count("api::product.product", { filters });
        const products = await strapi.entityService.findMany("api::product.product", {
          filters,
          sort: sortParam,
          populate,
          start: (pageNum - 1) * pageSizeNum,
          limit: pageSizeNum,
        });

        const pageCount = Math.ceil(totalCount / pageSizeNum);
        const sanitizedProducts = sanitizeProducts(products);

        return ctx.send({
          data: sanitizedProducts,
          meta: {
            pagination: { page: pageNum, pageSize: pageSizeNum, pageCount, total: totalCount },
            searchTerm,
            sellerId: Number(sellerId),
          },
        });
      } catch (error) {
        console.error("Error searching seller products:", error);
        return ctx.internalServerError("Failed to search seller products");
      }
    },

    // Get seller product aggregations (DB-based)
    async getSellerProductAggregations(ctx) {
      try {
        const { query, params } = ctx;
        const { availability, condition, categories } = query;
        const { sellerId } = params;

        const filters: any = {
          seller: { $eq: Number(sellerId) },
          activityStatus: { $ne: "archived" },
          status: { $eq: "available" },
        };

        const conditionArr = condition
          ? Array.isArray(condition) ? condition : [condition]
          : undefined;
        if (conditionArr && conditionArr.length > 0) {
          filters.condition = { $in: conditionArr };
        }

        const categoriesArr = categories
          ? Array.isArray(categories) ? categories : [categories]
          : undefined;
        if (categoriesArr && categoriesArr.length > 0) {
          const cats = await strapi.entityService.findMany("api::category.category", {
            filters: { slug: { $in: categoriesArr } },
            fields: ["id"],
          });
          if (cats && cats.length > 0) {
            filters.category = { id: { $in: cats.map((c: any) => c.id) } };
          }
        }

        const products: any[] = await strapi.entityService.findMany("api::product.product", {
          filters,
          fields: ["priceUSD", "priceEUR", "priceUAH", "status", "condition"],
          populate: { category: { fields: ["id", "name", "slug"] } },
          limit: -1,
        });

        const aggregations = computeAggregations(products);

        return ctx.send({ data: aggregations });
      } catch (error) {
        console.error("Error getting seller product aggregations:", error);
        return ctx.internalServerError("Failed to get seller product aggregations");
      }
    },

    async getTopProductsByCategories(ctx) {
      const startTime = Date.now();
      try {
        const populate = {
          category: {
            populate: {
              parent: true,
            },
          },
          tags: true,
          seller: {
            populate: {
              metadata: {
                populate: {
                  avatar: true,
                },
              },
            },
          },
          images: true,
        };

        // Получаем продукты, отсортированные по просмотрам
        // Берем больше, чем нужно, чтобы потом отфильтровать по уникальным категориям
        const allProducts = await strapi.entityService.findMany(
          "api::product.product",
          {
            filters: {
              status: {
                $eq: "available",
              },
              activityStatus: {
                $ne: "archived",
              },
            },
            sort: [{ viewsCount: "desc" }],
            populate,
            limit: 100, // Берем топ 100, чтобы точно покрыть все категории
          }
        );

        if (!allProducts || allProducts.length === 0) {
          return ctx.send({
            data: [],
          });
        }

        // Фильтруем продукты, оставляя только один продукт на категорию (самый популярный)
        const categoryMap = new Map();
        const topProducts: any[] = [];

        for (const product of allProducts) {
          const productAny = product as any;
          const categoryId = productAny.category?.id;

          // Пропускаем продукты без категории
          if (!categoryId) {
            continue;
          }

          // Если для этой категории еще нет продукта, добавляем его
          if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, true);
            topProducts.push(product);
          }

          // Останавливаемся, когда набрали достаточно продуктов
          // (по количеству основных категорий или лимиту)
          if (topProducts.length >= 50) {
            break;
          }
        }

        const endTime = Date.now();
        console.log(
          `Top products fetched in ${endTime - startTime}ms, found ${topProducts.length} products from ${allProducts.length} total`
        );

        // Sanitize seller fields
        const sanitizedProducts = sanitizeProducts(topProducts);

        return ctx.send({
          data: sanitizedProducts,
        });
      } catch (error) {
        console.error("Error getting top products by categories:", error);
        return ctx.internalServerError(
          "Failed to get top products by categories"
        );
      }
    },
  })
);
