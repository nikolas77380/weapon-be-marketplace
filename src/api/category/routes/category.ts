/**
 * category router
 */

export default {
  routes: [
    // Публичные роуты (без аутентификации)
    {
      method: "GET",
      path: "/categories/public",
      handler: "category.findPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/categories/public/:id",
      handler: "category.findOnePublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/categories/public/slug/:slug",
      handler: "category.findBySlugPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/categories/public/slug/:slug/products",
      handler: "category.getProductsBySlug",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/categories/public/slug/:slug/filters",
      handler: "category.getFiltersBySlug",
      config: {
        auth: false,
      },
    },
  ],
};
