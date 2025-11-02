/**
 * currency-rate router
 */

export default {
  routes: [
    {
      method: "GET",
      path: "/currency-rates/latest",
      handler: "currency-rate.getLatest",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
