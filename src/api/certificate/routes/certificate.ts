/**
 * certificate router
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/certificates/public",
      handler: "certificate.findPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/certificates/public/:id",
      handler: "certificate.findOnePublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/certificates",
      handler: "certificate.find",
      config: {
        auth: {
          scope: ["find"],
        },
      },
    },
    {
      method: "GET",
      path: "/certificates/:id",
      handler: "certificate.findOne",
      config: {
        auth: {
          scope: ["findOne"],
        },
      },
    },
    {
      method: "POST",
      path: "/certificates",
      handler: "certificate.create",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/certificates/:id",
      handler: "certificate.update",
      config: {
        auth: {},
      },
    },
    {
      method: "DELETE",
      path: "/certificates/:id",
      handler: "certificate.delete",
      config: {
        auth: {},
      },
    },
    // Custom getters
    {
      method: "GET",
      path: "/certificates/by-user/:userId",
      handler: "certificate.listByUser",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/certificates/by-product/:productId",
      handler: "certificate.listByProduct",
      config: {
        auth: false,
      },
    },
  ],
};
