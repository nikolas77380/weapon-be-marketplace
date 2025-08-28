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
  ],
};
