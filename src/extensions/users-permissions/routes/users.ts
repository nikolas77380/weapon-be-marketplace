/**
 * users router
 */

import { factories } from "@strapi/strapi";

const coreRouter = factories.createCoreRouter(
  "plugin::users-permissions.user",
  {
    config: {
      find: {
        auth: {
          scope: ["authenticated"],
        },
      },
      findOne: {
        auth: {
          scope: ["authenticated"],
        },
      },
      create: {
        auth: {
          scope: ["authenticated"],
        },
      },
      update: {
        auth: {
          scope: ["authenticated"],
        },
      },
      delete: {
        auth: {
          scope: ["authenticated"],
        },
      },
    },
    only: ["find", "findOne", "create", "update", "delete"],
    except: [],
  }
);

// Add custom routes for seller search
const customRoutes = [
  {
    method: "GET",
    path: "/users/search/sellers",
    handler: "user.searchSellers",
    config: {
      auth: {
        scope: ["authenticated"],
      },
    },
  },
  {
    method: "GET",
    path: "/users/search/sellers/public",
    handler: "user.searchSellersPublic",
    config: {
      auth: false,
    },
  },
  {
    method: "PUT",
    path: "/users/:id/role",
    handler: "user.changeUserRole",
    config: {
      auth: {
        scope: ["authenticated"],
      },
    },
  },
];

export default {
  routes: [
    ...(Array.isArray(coreRouter.routes)
      ? coreRouter.routes
      : coreRouter.routes()),
    ...customRoutes,
  ],
};
