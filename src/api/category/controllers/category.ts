/**
 * category controller
 */

import { factories } from "@strapi/strapi";

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

    // Получение продуктов категории через Elasticsearch
    async getProductsBySlug(ctx) {
      try {
        const { slug } = ctx.params;
        const { query } = ctx;

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

        const searchQuery = {
          searchTerm: search,
          categorySlug: slug,
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
            categorySlug: slug,
          },
        });
      } catch (error) {
        console.error("Error getting category products:", error);
        return ctx.internalServerError("Failed to get category products");
      }
    },

    // Получение фильтров для категории через Elasticsearch
    async getFiltersBySlug(ctx) {
      try {
        const { slug } = ctx.params;
        const { query } = ctx;

        const {
          priceRange,
          tags,
          status = "published",
          availability,
          condition,
          categories,
        } = query;

        const searchQuery = {
          categorySlug: slug,
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
          .getProductAggregations(searchQuery);

        return ctx.send({
          data: aggregations,
        });
      } catch (error) {
        console.error("Error getting category filters:", error);
        return ctx.internalServerError("Failed to get category filters");
      }
    },
  })
);
