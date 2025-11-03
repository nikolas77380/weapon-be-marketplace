/**
 * user-search router
 */

export default {
  routes: [
    {
      method: "GET",
      path: "/user-search/sellers",
      handler: "user-search.searchSellers",
      config: {
        auth: {
          scope: ["authenticated"],
        },
      },
    },
    {
      method: "GET",
      path: "/user-search/sellers/public",
      handler: "user-search.searchSellersPublic",
      config: {
        auth: false,
      },
    },
  ],
};
