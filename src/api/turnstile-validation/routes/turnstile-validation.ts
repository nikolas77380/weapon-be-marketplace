/**
 * Turnstile validation routes
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/turnstile-validation/validate",
      handler: "turnstile-validation.validateTurnstile",
      config: {
        auth: false, // Публичный endpoint
        policies: [],
        middlewares: [],
      },
    },
  ],
};
