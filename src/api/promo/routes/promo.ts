/**
 * promo router
 */

export default {
  routes: [
    {
      method: "GET",
      path: "/promos/public",
      handler: "promo.findPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/promos/public/:id",
      handler: "promo.findOnePublic",
      config: {
        auth: false,
      },
    },
  ],
};
