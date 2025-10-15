/**
 * user-role router
 */

export default {
  routes: [
    {
      method: "PUT",
      path: "/user-role/:id",
      handler: "user-role.changeUserRole",
      config: {
        auth: {
          scope: ["authenticated"],
        },
      },
    },
  ],
};
