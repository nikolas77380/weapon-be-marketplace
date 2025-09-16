import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::favourite.favourite",
  ({ strapi }) => ({
    async find(ctx) {
      try {
        const { user } = ctx.state;

        if (!user) {
          return ctx.unauthorized("Authentication required");
        }

        const favourites = await strapi.entityService.findMany(
          "api::favourite.favourite",
          {
            filters: { user: user.id },
            populate: {
              product: {
                populate: ["images", "seller", "category"],
              },
            },
          }
        );

        return { data: favourites };
      } catch (error) {
        console.error("Error fetching favourites:", error);
        return ctx.internalServerError("Failed to fetch favourites");
      }
    },

    async create(ctx) {
      try {
        const { user } = ctx.state;
        const { productId } = ctx.request.body;

        if (!user) {
          return ctx.unauthorized("Authentication required");
        }

        if (!productId) {
          return ctx.badRequest("Product ID is required");
        }

        const existingFavourite = await strapi.entityService.findMany(
          "api::favourite.favourite",
          {
            filters: {
              user: user.id,
              product: productId,
            },
          }
        );

        if (existingFavourite && existingFavourite.length > 0) {
          return ctx.badRequest("Product already in favourites");
        }

        const product = await strapi.entityService.findOne(
          "api::product.product",
          productId
        );
        if (!product) {
          return ctx.notFound("Product not found");
        }

        const favourite = await strapi.entityService.create(
          "api::favourite.favourite",
          {
            data: {
              user: user.id,
              product: productId,
            },
          }
        );

        return { data: favourite };
      } catch (error) {
        console.error("Error creating favourite:", error);
        return ctx.internalServerError("Failed to create favourite");
      }
    },

    async delete(ctx) {
      try {
        const { user } = ctx.state;
        const { id } = ctx.params;

        if (!user) {
          return ctx.unauthorized("Authentication required");
        }

        const favourite = await strapi.entityService.findOne(
          "api::favourite.favourite",
          id,
          {
            populate: {
              user: true,
            },
          }
        );

        if (!favourite) {
          return ctx.notFound("Favourite not found");
        }

        //@ts-ignore
        if (favourite.user?.id !== user.id) {
          return ctx.forbidden("Access denied");
        }

        await strapi.entityService.delete("api::favourite.favourite", id);

        return { success: true };
      } catch (error) {
        console.error("Error deleting favourite:", error);
        return ctx.internalServerError("Failed to delete favourite");
      }
    },

    async checkFavourite(ctx) {
      try {
        const { user } = ctx.state;
        const { productId } = ctx.query;

        if (!user) {
          return ctx.unauthorized("Authentication required");
        }

        if (!productId) {
          return ctx.badRequest("Product ID is required");
        }

        const favourite = await strapi.entityService.findMany(
          "api::favourite.favourite",
          {
            filters: {
              user: user.id,
              product: productId,
            },
          }
        );

        const isFavourited = favourite && favourite.length > 0;

        return {
          data: {
            isFavourited,
            favouriteId: isFavourited ? favourite[0].id : null,
          },
        };
      } catch (error) {
        console.error("Error checking favourite status:", error);
        return ctx.internalServerError("Failed to check favourite status");
      }
    },
  })
);
