/**
 * users router - custom routes only
 * Core routes are handled by Strapi automatically
 */

// Custom routes for seller search and user management
export default {
  routes: [
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
  ],
};
