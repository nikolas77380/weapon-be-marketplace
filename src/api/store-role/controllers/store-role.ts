/**
 * store-role controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::store-role.store-role",
  ({ strapi }) => ({
    async create(ctx) {
      const { type } = ctx.request.body;

      // Generate UUID for the store role
      const uuid =
        strapi.plugins["users-permissions"].services.user.generateUid();

      const storeRole = await strapi.entityService.create(
        "api::store-role.store-role",
        {
          data: {
            type,
            UUID: uuid,
            publishedAt: new Date(),
          },
        }
      );

      return storeRole;
    },
  })
);
