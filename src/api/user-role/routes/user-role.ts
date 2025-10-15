/**
 * user-role router
 */

export default {
  routes: [
    {
      method: "GET",
      path: "/user-role/test",
      handler: "user-role.test",
      config: {
        auth: false,
      },
    },
    {
      method: "PUT",
      path: "/user-role/:id",
      handler: "user-role.changeUserRole",
      config: {
        auth: false,
      },
    },
  ],
};
