/**
 * seller-meta controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::seller-meta.seller-meta",
  ({ strapi }) => ({
    async create(ctx) {
      try {
        // Get the authenticated user
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        // Check if user is a seller
        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can create seller metadata");
        }

        // Check if user already has metadata
        const existingMeta = await strapi.entityService.findMany(
          "api::seller-meta.seller-meta",
          {
            filters: {
              sellerEntity: user.id,
            },
          }
        );

        if (existingMeta.length > 0) {
          return ctx.badRequest("User already has seller metadata");
        }

        // Create seller-meta with proper relation
        const result = await strapi.entityService.create(
          "api::seller-meta.seller-meta",
          {
            data: {
              ...ctx.request.body.data,
              sellerEntity: user.id,
            },
            populate: {
              sellerEntity: true,
            },
          }
        );

        return result;
      } catch (error) {
        console.error("Error creating seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async find(ctx) {
      try {
        // Get the authenticated user
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        // Check if user is a seller
        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can access seller metadata");
        }

        // Find seller-meta by sellerEntity relation
        const sellerMeta = await strapi.entityService.findMany(
          "api::seller-meta.seller-meta",
          {
            filters: {
              sellerEntity: user.id,
            },
            populate: "*",
          }
        );

        return { data: sellerMeta };
      } catch (error) {
        console.error("Error finding seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async findOne(ctx) {
      try {
        // Get the authenticated user
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        // Check if user is a seller
        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can access seller metadata");
        }

        const { id } = ctx.params;

        // Check if the requested metadata belongs to the user
        const sellerMeta = (await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: {
              sellerEntity: true,
            },
          }
        )) as any;

        if (!sellerMeta || sellerMeta.sellerEntity?.id !== user.id) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        // Return the metadata with full population
        const result = await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: "*",
          }
        );

        return result;
      } catch (error) {
        console.error("Error finding seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async update(ctx) {
      try {
        // Get the authenticated user
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        // Check if user is a seller
        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can update seller metadata");
        }

        const { id } = ctx.params;

        // Check if the requested metadata belongs to the user
        const sellerMeta = (await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: {
              sellerEntity: true,
            },
          }
        )) as any;

        if (!sellerMeta || sellerMeta.sellerEntity?.id !== user.id) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        // Update the metadata
        const result = await strapi.entityService.update(
          "api::seller-meta.seller-meta",
          id,
          {
            data: ctx.request.body.data,
          }
        );

        return result;
      } catch (error) {
        console.error("Error updating seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async delete(ctx) {
      try {
        // Get the authenticated user
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        // Check if user is a seller
        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can delete seller metadata");
        }

        const { id } = ctx.params;

        // Check if the requested metadata belongs to the user
        const sellerMeta = (await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: {
              sellerEntity: true,
            },
          }
        )) as any;

        if (!sellerMeta || sellerMeta.sellerEntity?.id !== user.id) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        // Delete the metadata
        await strapi.entityService.delete("api::seller-meta.seller-meta", id);

        return { success: true };
      } catch (error) {
        console.error("Error deleting seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },
  })
);
