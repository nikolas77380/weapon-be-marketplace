/**
 * category controller
 */

import { factories } from "@strapi/strapi";
import { sanitizeProducts } from "../../product/utils/sanitizer";

// Recursively get all child category IDs
const getAllChildCategoryIds = async (strapi, categoryId) => {
  const childCategories = await strapi.entityService.findMany(
    "api::category.category",
    {
      filters: { parent: { id: { $eq: categoryId } } },
      fields: ["id"],
    }
  );

  let allChildIds = childCategories.map((cat) => cat.id);

  for (const childCategory of childCategories) {
    const grandChildIds = await getAllChildCategoryIds(strapi, childCategory.id);
    allChildIds = [...allChildIds, ...grandChildIds];
  }

  return allChildIds;
};

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

  const usdPrices = products.map((p) => p.priceUSD).filter((v) => v != null && v > 0);
  const eurPrices = products.map((p) => p.priceEUR).filter((v) => v != null && v > 0);
  const uahPrices = products.map((p) => p.priceUAH).filter((v) => v != null && v > 0);

  const safeMin = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);
  const safeMax = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);

  const availabilityMap: Record<string, number> = {};
  for (const p of products) {
    if (p.status) availabilityMap[p.status] = (availabilityMap[p.status] || 0) + 1;
  }

  const conditionMap: Record<string, number> = {};
  for (const p of products) {
    if (p.condition) conditionMap[p.condition] = (conditionMap[p.condition] || 0) + 1;
  }

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

  return {
    priceStats: { min: safeMin(usdPrices), max: safeMax(usdPrices) },
    priceStatsByCurrency: {
      USD: { min: safeMin(usdPrices), max: safeMax(usdPrices) },
      EUR: { min: safeMin(eurPrices), max: safeMax(eurPrices) },
      UAH: { min: safeMin(uahPrices), max: safeMax(uahPrices) },
    },
    availability: Object.entries(availabilityMap).map(([key, count]) => ({ key, count })),
    condition: Object.entries(conditionMap).map(([key, count]) => ({ key, count })),
    categories: Object.values(categoryMap),
  };
}

export default factories.createCoreController(
  "api::category.category",
  ({ strapi }) => ({
    async findPublic(ctx) {
      try {
        const entities = await strapi.entityService.findMany(
          "api::category.category",
          {
            populate: ["parent", "children", "icon"],
            sort: { order: "asc" },
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
          "api::category.category",
          id,
          {
            populate: ["parent", "children", "icon"],
          }
        );

        if (!entity) {
          return ctx.notFound("Category not found");
        }

        return { data: entity };
      } catch (error) {
        ctx.throw(500, error);
      }
    },

    async findBySlugPublic(ctx) {
      try {
        const { slug } = ctx.params;
        const entity = await strapi.entityService.findMany(
          "api::category.category",
          {
            filters: { slug },
            populate: ["parent", "children", "icon"],
          }
        );

        if (!entity || entity.length === 0) {
          return ctx.notFound("Category not found");
        }

        return { data: entity[0] };
      } catch (error) {
        ctx.throw(500, error);
      }
    },

    // Get category products from DB
    async getProductsBySlug(ctx) {
      try {
        const { slug } = ctx.params;
        const { query } = ctx;

        const {
          search = "",
          priceRange,
          currency = "USD",
          sort = "createdAt:desc",
          page = 1,
          pageSize = 10,
          availability,
          condition,
          categories,
        } = query;

        // Find the category by slug
        const categoryEntities = await strapi.entityService.findMany(
          "api::category.category",
          { filters: { slug }, fields: ["id"] }
        );

        if (!categoryEntities || categoryEntities.length === 0) {
          return ctx.send({
            data: [],
            meta: { pagination: { page: 1, pageSize: Number(pageSize), pageCount: 0, total: 0 } },
          });
        }

        const mainCategoryId = categoryEntities[0].id;
        const childCategoryIds = await getAllChildCategoryIds(strapi, mainCategoryId);
        let allCategoryIds = [mainCategoryId, ...childCategoryIds];

        // If specific subcategory slugs are provided, filter to those
        const categoriesArr = categories
          ? Array.isArray(categories) ? categories : [categories]
          : undefined;
        if (categoriesArr && categoriesArr.length > 0) {
          const subCats = await strapi.entityService.findMany("api::category.category", {
            filters: { slug: { $in: categoriesArr } },
            fields: ["id"],
          });
          if (subCats && subCats.length > 0) {
            const subCatIds = subCats.map((c: any) => c.id);
            // Intersect with allCategoryIds
            allCategoryIds = allCategoryIds.filter((id) => subCatIds.includes(id));
          }
        }

        const populate = {
          category: { populate: { parent: true } },
          tags: true,
          seller: { populate: { metadata: { populate: { avatar: true } } } },
          images: true,
        };

        const pageNum = Number(page);
        const pageSizeNum = Number(pageSize);

        const filters: any = {
          category: { id: { $in: allCategoryIds } },
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

        // Text search
        const searchTerm = (search as string).trim();
        if (searchTerm) {
          filters.$or = [
            { title: { $containsi: searchTerm } },
            { description: { $containsi: searchTerm } },
          ];
        }

        // Price range filter (currency-specific field)
        if (priceRange) {
          const pr = typeof priceRange === "string" ? JSON.parse(priceRange as string) : priceRange;
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

        // Sanitize seller fields in products
        const sanitizedProducts = sanitizeProducts(products);

        return ctx.send({
          data: sanitizedProducts,
          meta: {
            pagination: { page: pageNum, pageSize: pageSizeNum, pageCount, total: totalCount },
            searchTerm,
            categorySlug: slug,
          },
        });
      } catch (error) {
        console.error("Error getting category products:", error);
        return ctx.internalServerError("Failed to get category products");
      }
    },

    // Get category filters/aggregations from DB
    async getFiltersBySlug(ctx) {
      try {
        const { slug } = ctx.params;
        const { query } = ctx;

        const { availability, condition, categories } = query;

        // Find category by slug
        const categoryEntities = await strapi.entityService.findMany(
          "api::category.category",
          { filters: { slug }, fields: ["id"] }
        );

        if (!categoryEntities || categoryEntities.length === 0) {
          return ctx.send({ data: computeAggregations([]) });
        }

        const mainCategoryId = categoryEntities[0].id;
        const childCategoryIds = await getAllChildCategoryIds(strapi, mainCategoryId);
        let allCategoryIds = [mainCategoryId, ...childCategoryIds];

        const categoriesArr = categories
          ? Array.isArray(categories) ? categories : [categories]
          : undefined;
        if (categoriesArr && categoriesArr.length > 0) {
          const subCats = await strapi.entityService.findMany("api::category.category", {
            filters: { slug: { $in: categoriesArr } },
            fields: ["id"],
          });
          if (subCats && subCats.length > 0) {
            const subCatIds = subCats.map((c: any) => c.id);
            allCategoryIds = allCategoryIds.filter((id) => subCatIds.includes(id));
          }
        }

        const filters: any = {
          category: { id: { $in: allCategoryIds } },
          activityStatus: { $ne: "archived" },
        };

        const availabilityArr = availability
          ? Array.isArray(availability) ? availability : [availability]
          : undefined;
        if (availabilityArr && availabilityArr.length > 0) {
          filters.status = { $in: availabilityArr };
        }

        const conditionArr = condition
          ? Array.isArray(condition) ? condition : [condition]
          : undefined;
        if (conditionArr && conditionArr.length > 0) {
          filters.condition = { $in: conditionArr };
        }

        const products: any[] = await strapi.entityService.findMany("api::product.product", {
          filters,
          fields: ["priceUSD", "priceEUR", "priceUAH", "status", "condition"],
          populate: { category: { fields: ["id", "name", "slug"] } },
          limit: -1,
        });

        return ctx.send({ data: computeAggregations(products) });
      } catch (error) {
        console.error("Error getting category filters:", error);
        return ctx.internalServerError("Failed to get category filters");
      }
    },
  })
);
