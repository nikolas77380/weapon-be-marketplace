/**
 * product service
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreService(
  "api::product.product",
  ({ strapi }) => ({
    async beforeCreate(event) {
      const { data } = event.params;

      console.log("=== BEFORE CREATE LIFECYCLE ===");
      console.log("Data before processing:", JSON.stringify(data, null, 2));

      // Handle admin panel format for relations
      if (
        data.category &&
        typeof data.category === "object" &&
        data.category.connect
      ) {
        data.category = data.category.connect[0].id;
      }

      if (
        data.seller &&
        typeof data.seller === "object" &&
        data.seller.connect
      ) {
        data.seller = data.seller.connect[0].id;
      }

      // Handle tags relation if it exists
      if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
        if (
          data.tags[0] &&
          typeof data.tags[0] === "object" &&
          data.tags[0].connect
        ) {
          data.tags = data.tags.map((tag) => tag.connect[0].id);
        }
      }

      // Handle status field
      if (data.status) {
        if (typeof data.status === "object" && data.status !== null) {
          const statusObj = data.status as any;
          if (statusObj.value) {
            data.status = statusObj.value;
          } else if (statusObj.label) {
            data.status = statusObj.label;
          }
        } else if (Array.isArray(data.status)) {
          data.status = data.status[0];
        }
        data.status = String(data.status).trim().toLowerCase();
      }

      // Remove null values
      Object.keys(data).forEach((key) => {
        if (data[key] === null) {
          delete data[key];
        }
      });

      console.log("Data after processing:", JSON.stringify(data, null, 2));
      console.log("=== END BEFORE CREATE LIFECYCLE ===");
    },
  })
);
