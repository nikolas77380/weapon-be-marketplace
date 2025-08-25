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
        if (user.metadata) {
          return ctx.badRequest("User already has seller metadata");
        }

        // Create seller-meta
        const result = await strapi.entityService.create(
          "api::seller-meta.seller-meta",
          {
            data: {
              ...ctx.request.body.data,
              sellerEntity: user.id,
            },
          }
        );

        // Update user to link with the created metadata
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          user.id,
          {
            data: {
              metadata: result.id,
            },
          }
        );

        // Return the created seller-meta
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

        // If user has metadata, return only their metadata
        if (user.metadata) {
          const result = await strapi.entityService.findOne(
            "api::seller-meta.seller-meta",
            user.metadata.id,
            {
              populate: "*",
            }
          );
          return { data: [result] };
        }

        // If user doesn't have metadata, return empty array
        return { data: [] };
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
        if (!user.metadata || user.metadata.id !== parseInt(id)) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        // Return the metadata
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
        if (!user.metadata || user.metadata.id !== parseInt(id)) {
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
        if (!user.metadata || user.metadata.id !== parseInt(id)) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        // Delete the metadata
        await strapi.entityService.delete("api::seller-meta.seller-meta", id);

        // Update user to remove metadata link
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          user.id,
          {
            data: {
              metadata: null,
            },
          }
        );

        return { success: true };
      } catch (error) {
        console.error("Error deleting seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },
  })
);
