/**
 * category controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::category.category",
  ({ strapi }) => ({
    async findPublic(ctx) {
      try {
        const { data, meta } = await super.find(ctx);
        return { data, meta };
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
            populate: ["parent", "children"],
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
            populate: ["parent", "children"],
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
  })
);
