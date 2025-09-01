/**
 * users router
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("plugin::users-permissions.user", {
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
});
