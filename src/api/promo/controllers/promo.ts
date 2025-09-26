/**
 * promo controller
 */

import { factories } from "@strapi/strapi";

// Функция для рекурсивного поиска промо в родительских категориях
const findPromoInParentCategories = async (strapi, categoryId) => {
  // Сначала ищем промо в текущей категории
  const currentCategoryPromos = await strapi.entityService.findMany(
    "api::promo.promo",
    {
      filters: {
        category: { id: { $eq: categoryId } },
        isActive: true,
        publishedAt: { $notNull: true },
      },
      populate: ["image", "category"],
      sort: { createdAt: "desc" },
    }
  );

  // Если нашли промо в текущей категории, возвращаем их
  if (currentCategoryPromos && currentCategoryPromos.length > 0) {
    return currentCategoryPromos;
  }

  // Если промо нет, получаем родительскую категорию
  const currentCategory = await strapi.entityService.findOne(
    "api::category.category",
    categoryId,
    {
      populate: ["parent"],
    }
  );

  // Если есть родительская категория, рекурсивно ищем промо в ней
  if (currentCategory && currentCategory.parent) {
    return await findPromoInParentCategories(strapi, currentCategory.parent.id);
  }

  // Если дошли до корневой категории и промо нет, возвращаем пустой массив
  return [];
};

export default factories.createCoreController(
  "api::promo.promo",
  ({ strapi }) => ({
    async findPublic(ctx) {
      try {
        const { category, categorySlug } = ctx.query;

        let categoryId = category;

        // Если передан slug категории, находим ID категории
        if (categorySlug && !categoryId) {
          const categoryBySlug = await strapi.entityService.findMany(
            "api::category.category",
            {
              filters: { slug: categorySlug },
            }
          );

          if (categoryBySlug && categoryBySlug.length > 0) {
            categoryId = categoryBySlug[0].id;
          } else {
            // Если категория не найдена, возвращаем пустой результат
            return { data: [] };
          }
        }

        // Если указана категория, ищем промо в ней и родительских категориях
        if (categoryId) {
          const entities = await findPromoInParentCategories(
            strapi,
            categoryId
          );
          return { data: entities };
        }
        const entities = await strapi.entityService.findMany(
          "api::promo.promo",
          {
            filters: {
              isActive: true,
              category: { id: { $null: true } },
            },
            populate: ["image", "category"],
            sort: { createdAt: "desc" },
          }
        );

        return { data: entities };
      } catch (error) {
        ctx.throw(500, error);
      }
    },

    async findOnePublic(ctx) {
      try {
        const { id } = ctx.params;
        const entity = await strapi.entityService.findOne(
          "api::promo.promo",
          id,
          {
            filters: {
              isActive: true,
              publishedAt: { $notNull: true },
            },
            populate: ["image", "category"],
          }
        );

        if (!entity) {
          return ctx.notFound("Promo not found");
        }

        return { data: entity };
      } catch (error) {
        ctx.throw(500, error);
      }
    },
  })
);
