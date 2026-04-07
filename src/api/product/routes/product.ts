/**
 * product router
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/products/public",
      handler: "product.findPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products/public/top-by-categories",
      handler: "product.getTopProductsByCategories",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products/public/:id",
      handler: "product.findOnePublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products",
      handler: "product.find",
      config: {
        auth: {
          scope: ["find"],
        },
      },
    },
    {
      method: "GET",
      path: "/products/:id",
      handler: "product.findOne",
      config: {
        auth: {
          scope: ["findOne"],
        },
      },
    },
    {
      method: "POST",
      path: "/products",
      handler: "product.create",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/products/:id",
      handler: "product.update",
      config: {
        auth: {},
      },
    },
    {
      method: "DELETE",
      path: "/products/:id",
      handler: "product.delete",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/products/search/public",
      handler: "product.searchPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products/seller/:sellerId/search",
      handler: "product.searchSellerProducts",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products/seller/:sellerId/aggregations",
      handler: "product.getSellerProductAggregations",
      config: {
        auth: false,
      },
    },
  ],
};
