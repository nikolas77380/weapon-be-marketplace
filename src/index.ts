import type { Core } from "@strapi/strapi";
import userServiceOverride from "./extensions/users-permissions/services/user";
import authControllerOverride from "./extensions/users-permissions/controllers/auth";

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    console.log("Registering custom overrides");
    userServiceOverride(strapi.plugins["users-permissions"]);
    authControllerOverride(strapi.plugins["users-permissions"]);
    console.log("Custom overrides registered");
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};
