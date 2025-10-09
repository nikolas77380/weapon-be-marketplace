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
      path: "/products/search/elastic",
      handler: "product.searchElastic",
      config: {
        auth: {
          scope: ["find"],
        },
      },
    },
    {
      method: "GET",
      path: "/products/search/elastic/public",
      handler: "product.searchElasticPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products/aggregations",
      handler: "product.getAggregations",
      config: {
        auth: {
          scope: ["find"],
        },
      },
    },
    {
      method: "GET",
      path: "/products/aggregations/public",
      handler: "product.getAggregationsPublic",
      config: {
        auth: false,
      },
    },
  ],
};
