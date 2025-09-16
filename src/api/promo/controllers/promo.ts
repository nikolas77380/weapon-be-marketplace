/**
 * promo controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::promo.promo",
  ({ strapi }) => ({
    async findPublic(ctx) {
      try {
        const { category } = ctx.query;

        const filters: any = {
          isActive: true,
          publishedAt: { $notNull: true },
        };

        if (category) {
          filters.category = category;
        } else {
          filters.category = { $null: true };
        }

        const entities = await strapi.entityService.findMany(
          "api::promo.promo",
          {
            filters,
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
