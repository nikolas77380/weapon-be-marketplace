/**
 * auth router
 */

// Custom routes for email confirmation
const customRoutes = [
  {
    method: "GET",
    path: "/auth/confirm",
    handler: "auth.confirm",
    config: {
      auth: false,
    },
  },
];

export default {
  routes: customRoutes,
};
