export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Initialize Elasticsearch
    try {
      await strapi.service("api::product.elasticsearch").initialize();
      console.log("Elasticsearch initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Elasticsearch:", error);
      // Don't fail the bootstrap if Elasticsearch is not available
    }
  },
};
