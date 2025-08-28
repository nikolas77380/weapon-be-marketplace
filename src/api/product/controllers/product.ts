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
        // Получаем данные из запроса
        const { data } = ctx.request.body;

        // Проверяем, что пользователь аутентифицирован
        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to create a product"
          );
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

        // Создаем продукт
        const product = await strapi.entityService.create(
          "api::product.product",
          {
            data: productData,
            populate: {
              category: true,
              tags: true,
              seller: true,
            },
          }
        );

        return ctx.created(product);
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
            },
          }
        );

        if (!product) {
          return ctx.notFound("Product not found");
        }

        return ctx.send(product);
      } catch (error) {
        console.error("Error fetching product:", error);
        return ctx.internalServerError("Failed to fetch product");
      }
    },

    async update(ctx) {
      try {
        const { id } = ctx.params;
        const { data } = ctx.request.body;

        // Проверяем, что пользователь аутентифицирован
        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to update a product"
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
          return ctx.forbidden("You can only update your own products");
        }

        // Генерируем новый slug, если заголовок изменился
        if (data.title && data.title !== (existingProduct as any).title) {
          data.slug = await generateUniqueSlug(strapi, data.title, id);
        }

        // Обновляем продукт
        const product = await strapi.entityService.update(
          "api::product.product",
          id,
          {
            data,
            populate: {
              category: true,
              tags: true,
              seller: true,
            },
          }
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
