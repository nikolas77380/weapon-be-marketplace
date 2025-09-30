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
          category: true,
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
              category: true,
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

        const productData = {
          ...data,
          seller: ctx.state.user.id,
          publishedAt: new Date(), // Автоматически публикуем продукт
        };

        if (!productData.title) {
          return ctx.badRequest("Title is required");
        }

        if (!productData.category) {
          return ctx.badRequest("Category is required");
        }

        if (productData.price === undefined || productData.price < 0) {
          return ctx.badRequest("Valid price is required");
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
            category: true,
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
              category: true,
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

        return ctx.created(finalProduct);
      } catch (error) {
        console.error("Error creating product:", error);
        return ctx.internalServerError("Failed to create product");
      }
    },

    async find(ctx) {
      try {
        const { query } = ctx;

        const populate = {
          category: true,
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
              category: true,
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

        if (data.title && data.title !== (existingProduct as any).title) {
          data.slug = await generateUniqueSlug(strapi, data.title, productId);
        }

        const updateOptions: any = {
          data,
          populate: {
            category: true,
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

        return ctx.send({ message: "Product deleted successfully" });
      } catch (error) {
        console.error("Error deleting product:", error);
        return ctx.internalServerError("Failed to delete product");
      }
    },
  })
);
