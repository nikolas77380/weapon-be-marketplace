/**
 * product controller
 */

import { factories } from "@strapi/strapi";
import { generateUniqueSlug } from "../../../utils/slug";

export default factories.createCoreController(
  "api::product.product",
  ({ strapi }) => ({
    async create(ctx) {
      try {
        // Проверяем, что пользователь аутентифицирован
        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to create a product"
          );
        }

        // Получаем данные из запроса
        let data;
        if (ctx.request.body.data) {
          // Если данные пришли как JSON строка (из FormData)
          data =
            typeof ctx.request.body.data === "string"
              ? JSON.parse(ctx.request.body.data)
              : ctx.request.body.data;
        } else {
          // Если данные пришли как обычный JSON объект
          data = ctx.request.body;
        }

        // Добавляем продавца к данным продукта
        const productData = {
          ...data,
          seller: ctx.state.user.id,
          publishedAt: new Date(), // Автоматически публикуем продукт
        };

        // Валидация обязательных полей
        if (!productData.title) {
          return ctx.badRequest("Title is required");
        }

        if (!productData.category) {
          return ctx.badRequest("Category is required");
        }

        if (productData.price === undefined || productData.price < 0) {
          return ctx.badRequest("Valid price is required");
        }

        // Генерируем уникальный slug, если он не предоставлен
        if (!productData.slug) {
          productData.slug = await generateUniqueSlug(
            strapi,
            productData.title
          );
        }

        // Сначала создаем продукт без файлов
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

        // Если есть файлы, загружаем их отдельно и связываем с продуктом
        if (ctx.request.files && ctx.request.files["files.images"]) {
          console.log("Uploading files separately...");

          const files = ctx.request.files["files.images"];
          const uploadedFiles = [];

          // Загружаем каждый файл
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

          // Обновляем продукт с информацией о загруженных файлах
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

        // Получаем финальную версию продукта с изображениями
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

        // Если finalProduct null, возвращаем созданный продукт
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
        // Получаем параметры запроса
        const { query } = ctx;

        // Добавляем populate для связанных данных
        const populate = {
          category: true,
          tags: true,
          seller: true,
          images: true,
        };

        // Выполняем запрос с populate
        const products = await strapi.entityService.findMany(
          "api::product.product",
          {
            ...query,
            populate,
          }
        );

        return ctx.send(products);
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

        // Создаем запись о просмотре и увеличиваем счетчик
        try {
          // Получаем ID пользователя (если он аутентифицирован)
          const userId = ctx.state.user?.id || "anonymous";

          console.log("=== VIEW TRACKING START ===");
          console.log("Creating view for product:", id, "user:", userId);

          // Проверяем существование просмотра
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
            // Создаем новую запись о просмотре
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

          // Увеличиваем счетчик просмотров в продукте только для новых просмотров
          if (isNewView) {
            // Получаем актуальное значение счетчика из БД перед обновлением
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

            // Обновляем счетчик в БД
            await strapi.entityService.update("api::product.product", id, {
              data: {
                viewsCount: newViewsCount,
              },
            });

            // Обновляем объект продукта для ответа
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
          // Логируем ошибку, но не прерываем выполнение
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

        // Проверяем, что пользователь аутентифицирован
        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to update a product"
          );
        }

        // Получаем данные из запроса
        let data;
        if (ctx.request.body.data) {
          // Если данные пришли как JSON строка (из FormData)
          data =
            typeof ctx.request.body.data === "string"
              ? JSON.parse(ctx.request.body.data)
              : ctx.request.body.data;
        } else {
          // Если данные пришли как обычный JSON объект
          data = ctx.request.body;
        }

        console.log("Update product data:", data);
        console.log("Update files:", ctx.request.files);

        // Получаем продукт для проверки владельца
        const existingProduct = await strapi.entityService.findOne(
          "api::product.product",
          id
        );

        if (!existingProduct) {
          return ctx.notFound("Product not found");
        }

        // Проверяем, что пользователь является владельцем продукта
        if ((existingProduct as any).seller?.id !== ctx.state.user.id) {
          return ctx.forbidden("You can only update your own products");
        }

        // Генерируем новый slug, если заголовок изменился
        if (data.title && data.title !== (existingProduct as any).title) {
          data.slug = await generateUniqueSlug(strapi, data.title, id);
        }

        // Обновляем продукт с файлами, если они есть
        const updateOptions: any = {
          data,
          populate: {
            category: true,
            tags: true,
            seller: true,
            images: true,
          },
        };

        // Если есть файлы, добавляем их к опциям обновления
        if (ctx.request.files && ctx.request.files["files.images"]) {
          updateOptions.files = {
            images: ctx.request.files["files.images"],
          };
        }

        const product = await strapi.entityService.update(
          "api::product.product",
          id,
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

        // Проверяем, что пользователь аутентифицирован
        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to delete a product"
          );
        }

        // Получаем продукт для проверки владельца
        const existingProduct = await strapi.entityService.findOne(
          "api::product.product",
          id
        );

        if (!existingProduct) {
          return ctx.notFound("Product not found");
        }

        // Проверяем, что пользователь является владельцем продукта
        if ((existingProduct as any).seller?.id !== ctx.state.user.id) {
          return ctx.forbidden("You can only delete your own products");
        }

        // Удаляем продукт
        await strapi.entityService.delete("api::product.product", id);

        return ctx.send({ message: "Product deleted successfully" });
      } catch (error) {
        console.error("Error deleting product:", error);
        return ctx.internalServerError("Failed to delete product");
      }
    },
  })
);
