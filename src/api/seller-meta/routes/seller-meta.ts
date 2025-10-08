/**
 * seller-meta router
 */

export default {
  routes: [
    // Публичные роуты (без аутентификации) - только для чтения
    {
      method: "GET",
      path: "/seller-metas/public",
      handler: "seller-meta.findPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/seller-metas/public/:id",
      handler: "seller-meta.findOnePublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/seller-metas/public/seller/:sellerId",
      handler: "seller-meta.findBySellerPublic",
      config: {
        auth: false,
      },
    },
    // Защищенные роуты (требуют аутентификации)
    {
      method: "GET",
      path: "/seller-metas",
      handler: "seller-meta.find",
      config: {
        auth: {
          scope: ["find"],
        },
      },
    },
    {
      method: "GET",
      path: "/seller-metas/:id",
      handler: "seller-meta.findOne",
      config: {
        auth: {
          scope: ["findOne"],
        },
      },
    },
    {
      method: "POST",
      path: "/seller-metas",
      handler: "seller-meta.create",
      config: {
        auth: {
          scope: ["create"],
        },
      },
    },
    {
      method: "PUT",
      path: "/seller-metas/:id",
      handler: "seller-meta.update",
      config: {
        auth: {
          scope: ["update"],
        },
      },
    },
    {
      method: "DELETE",
      path: "/seller-metas/:id",
      handler: "seller-meta.delete",
      config: {
        auth: {
          scope: ["delete"],
        },
      },
    },
    {
      method: "POST",
      path: "/seller-metas/:id/avatar",
      handler: "seller-meta.uploadAvatar",
      config: {
        auth: {
          scope: ["update"],
        },
      },
    },
  ],
};
