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
import { indexProduct } from "../../../utils/elasticsearch";

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

export default factories.createCoreController(
  "api::product.product",
  ({ strapi }) => ({
    async findPublic(ctx) {
      try {
        const { query } = ctx;

        const populate = {
          category: {
            populate: {
              parent: true,
            },
          },
          tags: true,
          seller: true,
          images: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 5;

        const filters = { ...(query.filters as any) };

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
            filters.category = { $in: allCategoryIds };
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

        return ctx.send({
          data: products,
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
              seller: true,
              images: true,
            },
          }
        );

        if (!product) {
          return ctx.notFound("Product not found");
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

        return ctx.send(product);
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

        console.log(
          "Original data from request:",
          JSON.stringify(data, null, 2)
        );
        console.log("Request headers:", ctx.request.headers);
        console.log("Request URL:", ctx.request.url);
        console.log("Request method:", ctx.request.method);

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
        const validStatuses = ["available", "reserved", "sold", "archived"];
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

        const createOptions: any = {
          data: productData,
          populate: {
            category: {
              populate: {
                parent: true,
              },
            },
            tags: true,
            seller: true,
            images: true,
          },
        };

        console.log("Creating product without files first...");
        const product = await strapi.entityService.create(
          "api::product.product",
          createOptions
        );

        console.log("Created product:", product);

        if (ctx.request.files && ctx.request.files["files.images"]) {
          console.log("Uploading files separately...");

          const files = ctx.request.files["files.images"];
          const uploadedFiles = [];

          for (const file of Array.isArray(files) ? files : [files]) {
            console.log(
              "Uploading file:",
              (file as any).name,
              (file as any).size
            );
            const uploadedFile =
              await strapi.plugins.upload.services.upload.upload({
                data: {
                  refId: product.id,
                  ref: "api::product.product",
                  field: "images",
                },
                files: file,
              });
            uploadedFiles.push(uploadedFile);
          }

          console.log("Uploaded files:", uploadedFiles);

          const fileIds = uploadedFiles.flat().map((file) => file.id);
          console.log("File IDs to link:", fileIds);

          if (fileIds.length > 0) {
            const updateResult = await strapi.entityService.update(
              "api::product.product",
              product.id,
              {
                data: {
                  images: fileIds,
                },
              }
            );

            console.log("Product updated with file IDs:", updateResult);
          }
        }

        console.log("Fetching final product with ID:", product.id);
        const finalProduct = await strapi.entityService.findOne(
          "api::product.product",
          product.id,
          {
            populate: {
              category: {
                populate: {
                  parent: true,
                },
              },
              tags: true,
              seller: true,
              images: true,
            },
          }
        );

        console.log("Final product with images:", finalProduct);

        if (!finalProduct) {
          console.log("Final product is null, returning created product");
          return ctx.created(product);
        }

        // Index product in Elasticsearch
        try {
          // Use finalProduct which has all populated relations
          if (finalProduct) {
            await indexProduct(finalProduct);
            console.log(
              `✅ Product ${finalProduct.id} successfully indexed in Elasticsearch from controller`
            );
          } else if (product) {
            // Fallback: fetch product with relations if finalProduct is null
            const productWithRelations = await strapi.entityService.findOne(
              "api::product.product",
              product.id,
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
                      metadata: true,
                    },
                  },
                  images: true,
                  subcategories: true,
                },
              }
            );
            if (productWithRelations) {
              await indexProduct(productWithRelations);
              console.log(
                `✅ Product ${productWithRelations.id} successfully indexed in Elasticsearch from controller`
              );
            }
          }
        } catch (elasticError) {
          console.error(
            "Error indexing product in Elasticsearch:",
            elasticError
          );
          // Don't fail the request if Elasticsearch indexing fails
        }

        console.log("=== PRODUCT CREATE CONTROLLER SUCCESS ===");
        return ctx.created(finalProduct);
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
          seller: true,
          images: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 5;

        const filters = { ...(query.filters as any) };

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
            filters.category = { $in: allCategoryIds };
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

        return ctx.send({
          data: products,
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
              seller: true,
              images: true,
            },
          }
        );

        if (!product) {
          return ctx.notFound("Product not found");
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

        return ctx.send(product);
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
          const validStatuses = ["available", "reserved", "sold", "archived"];
          if (!validStatuses.includes(data.status)) {
            return ctx.badRequest(
              `Invalid status. Must be one of: ${validStatuses.join(", ")}`
            );
          }
        }

        if (data.title && data.title !== (existingProduct as any).title) {
          data.slug = await generateUniqueSlug(strapi, data.title, productId);
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
            seller: true,
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

        // Update product in Elasticsearch
        try {
          await strapi
            .service("api::product.elasticsearch")
            .indexProduct(productId);
        } catch (elasticError) {
          console.error(
            "Error updating product in Elasticsearch:",
            elasticError
          );
          // Don't fail the request if Elasticsearch indexing fails
        }

        return ctx.send(product);
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
          { populate: { seller: true } }
        );

        if (!existingProduct) {
          return ctx.notFound("Product not found");
        }

        if ((existingProduct as any).seller?.id !== ctx.state.user.id) {
          return ctx.forbidden("You can only delete your own products");
        }

        await strapi.entityService.delete("api::product.product", id);

        // Remove product from Elasticsearch
        try {
          await strapi
            .service("api::product.elasticsearch")
            .removeProduct(Number(id));
        } catch (elasticError) {
          console.error(
            "Error removing product from Elasticsearch:",
            elasticError
          );
          // Don't fail the request if Elasticsearch removal fails
        }

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
              metadata: true,
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
            filters.category = { $in: allCategoryIds };
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

        return ctx.send({
          data: products,
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
              metadata: true,
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
            filters.category = { $in: allCategoryIds };
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

        return ctx.send({
          data: products,
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

    // Elasticsearch-powered search
    async searchElastic(ctx) {
      try {
        const { query } = ctx;
        const {
          search = "",
          categorySlug,
          priceRange,
          tags,
          status = "available",
          sort = "createdAt:desc",
          page = 1,
          pageSize = 10,
        } = query;

        const searchQuery = {
          searchTerm: search,
          categorySlug,
          priceRange: priceRange ? JSON.parse(priceRange as string) : undefined,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
          status,
          sort,
          page: Number(page),
          pageSize: Number(pageSize),
        };

        const result = await strapi
          .service("api::product.elasticsearch")
          .searchProducts(searchQuery);

        return ctx.send({
          data: result.hits,
          meta: {
            pagination: {
              page: result.page,
              pageSize: result.pageSize,
              pageCount: result.pageCount,
              total: result.total,
            },
            searchTerm: search,
          },
        });
      } catch (error) {
        console.error("Error in Elasticsearch search:", error);
        return ctx.internalServerError("Failed to search products");
      }
    },

    // Get product aggregations for filters
    async getAggregations(ctx) {
      try {
        const { query } = ctx;
        const { categorySlug, priceRange, tags, status = "available" } = query;

        const searchQuery = {
          categorySlug,
          priceRange: priceRange ? JSON.parse(priceRange as string) : undefined,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
          status,
        };

        const aggregations = await strapi
          .service("api::product.elasticsearch")
          .getProductAggregations(searchQuery);

        return ctx.send({
          data: aggregations,
        });
      } catch (error) {
        console.error("Error getting product aggregations:", error);
        return ctx.internalServerError("Failed to get product aggregations");
      }
    },

    // Public Elasticsearch search
    async searchElasticPublic(ctx) {
      try {
        const { query } = ctx;
        const {
          search = "",
          categorySlug,
          priceRange,
          tags,
          status = "available",
          sort = "createdAt:desc",
          page = 1,
          pageSize = 10,
        } = query;

        const searchQuery = {
          searchTerm: search,
          categorySlug,
          priceRange: priceRange ? JSON.parse(priceRange as string) : undefined,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
          status,
          sort,
          page: Number(page),
          pageSize: Number(pageSize),
        };

        const result = await strapi
          .service("api::product.elasticsearch")
          .searchProducts(searchQuery);

        return ctx.send({
          data: result.hits,
          meta: {
            pagination: {
              page: result.page,
              pageSize: result.pageSize,
              pageCount: result.pageCount,
              total: result.total,
            },
            searchTerm: search,
          },
        });
      } catch (error) {
        console.error("Error in public Elasticsearch search:", error);
        return ctx.internalServerError("Failed to search products");
      }
    },

    // Public aggregations
    async getAggregationsPublic(ctx) {
      try {
        const { query } = ctx;
        const { categorySlug, priceRange, tags, status = "available" } = query;

        const searchQuery = {
          categorySlug,
          priceRange: priceRange ? JSON.parse(priceRange as string) : undefined,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
          status,
        };

        const aggregations = await strapi
          .service("api::product.elasticsearch")
          .getProductAggregations(searchQuery);

        return ctx.send({
          data: aggregations,
        });
      } catch (error) {
        console.error("Error getting public product aggregations:", error);
        return ctx.internalServerError("Failed to get product aggregations");
      }
    },

    // Search seller products with Elasticsearch
    async searchSellerProductsElastic(ctx) {
      try {
        const { query, params } = ctx;
        const {
          search = "",
          priceRange,
          tags,
          status = "published",
          sort = "createdAt:desc",
          page = 1,
          pageSize = 10,
          availability,
          condition,
          categories,
        } = query;
        const { sellerId } = params;

        const searchQuery = {
          searchTerm: search,
          sellerId: Number(sellerId),
          priceRange: priceRange ? JSON.parse(priceRange as string) : undefined,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
          status,
          sort,
          page: Number(page),
          pageSize: Number(pageSize),
          availability: availability
            ? Array.isArray(availability)
              ? availability
              : [availability]
            : undefined,
          condition: condition
            ? Array.isArray(condition)
              ? condition
              : [condition]
            : undefined,
          categories: categories
            ? Array.isArray(categories)
              ? categories
              : [categories]
            : undefined,
        };

        const result = await strapi
          .service("api::product.elasticsearch")
          .searchProductsBySeller(searchQuery);

        return ctx.send({
          data: result.hits,
          meta: {
            pagination: {
              page: result.page,
              pageSize: result.pageSize,
              pageCount: result.pageCount,
              total: result.total,
            },
            searchTerm: search,
            sellerId: Number(sellerId),
          },
        });
      } catch (error) {
        console.error(
          "Error searching seller products with Elasticsearch:",
          error
        );
        return ctx.internalServerError("Failed to search seller products");
      }
    },

    // Get seller product aggregations
    async getSellerProductAggregations(ctx) {
      try {
        const { query, params } = ctx;
        const {
          priceRange,
          tags,
          status = "published",
          availability,
          condition,
          categories,
        } = query;
        const { sellerId } = params;

        const searchQuery = {
          sellerId: Number(sellerId),
          priceRange: priceRange ? JSON.parse(priceRange as string) : undefined,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
          status,
          availability: availability
            ? Array.isArray(availability)
              ? availability
              : [availability]
            : undefined,
          condition: condition
            ? Array.isArray(condition)
              ? condition
              : [condition]
            : undefined,
          categories: categories
            ? Array.isArray(categories)
              ? categories
              : [categories]
            : undefined,
        };

        const aggregations = await strapi
          .service("api::product.elasticsearch")
          .getSellerProductAggregations(searchQuery);

        return ctx.send({
          data: aggregations,
        });
      } catch (error) {
        console.error("Error getting seller product aggregations:", error);
        return ctx.internalServerError(
          "Failed to get seller product aggregations"
        );
      }
    },
  })
);
