/**
 * Custom routes for support form
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/support-form/send-email",
      handler: "support-form.sendSupportEmail",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/support-form/admin",
      handler: "support-form.findAdmin",
      config: {
        auth: {
          scope: ["authenticated"],
        },
      },
    },
    {
      method: "PUT",
      path: "/support-form/:id/status",
      handler: "support-form.updateStatus",
      config: {
        auth: {
          scope: ["authenticated"],
        },
      },
    },
  ],
};
