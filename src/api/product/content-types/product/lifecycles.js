module.exports = {
  async afterCreate(event) {
    const { result } = event;
    console.log(
      `🔄 [LIFECYCLE] Product created: ${result.id} - ${result.title}`
    );

    try {
      // Load elasticsearch functions dynamically
      const esUtils = await import("../../../../utils/elasticsearch.js");
      const { indexProduct } = esUtils;

      // Get full product with relations for indexing
      const fullProduct = await strapi.entityService.findOne(
        "api::product.product",
        result.id,
        {
          populate: {
            category: {
              populate: {
                parent: true,
              },
            },
            tags: true,
            seller: {
              populate: {
                metadata: {
                  populate: {
                    avatar: true,
                  },
                },
              },
            },
            images: true,
            subcategories: true,
          },
        }
      );

      if (fullProduct) {
        console.log(`📦 [LIFECYCLE] Product data ready for indexing:`, {
          id: fullProduct.id,
          title: fullProduct.title,
          category: fullProduct.category?.name,
        });
        await indexProduct(fullProduct);
        console.log(
          `✅ [LIFECYCLE] Product ${result.id} successfully indexed in Elasticsearch`
        );
      } else {
        console.log(
          `⚠️ [LIFECYCLE] Product ${result.id} not found after creation`
        );
      }
    } catch (error) {
      console.error(`❌ [LIFECYCLE] Failed to index product ${result.id}:`, {
        error: error.message,
        productId: result.id,
        productTitle: result.title,
        stack: error.stack,
      });

      // Try to send failure notification
      try {
        const emailUtils = await import(
          "../../../../utils/email-notifications.js"
        );
        const { sendProductSyncFailureNotification } = emailUtils;
        await sendProductSyncFailureNotification(
          result.id,
          result.title || "Unknown",
          error.message
        );
        console.log(
          `📧 [LIFECYCLE] Email notification sent for product ${result.id} sync failure`
        );
      } catch (emailError) {
        console.error(
          "❌ [LIFECYCLE] Failed to send product sync failure notification:",
          emailError
        );
      }
    }
  },

  async afterUpdate(event) {
    const { result } = event;
    console.log(
      `🔄 [LIFECYCLE] Product updated: ${result.id} - ${result.title}`
    );

    try {
      // Load elasticsearch functions dynamically
      const esUtils = await import("../../../../utils/elasticsearch.js");
      const { indexProduct } = esUtils;

      // Get full product with relations for indexing
      const fullProduct = await strapi.entityService.findOne(
        "api::product.product",
        result.id,
        {
          populate: {
            category: {
              populate: {
                parent: true,
              },
            },
            tags: true,
            seller: {
              populate: {
                metadata: {
                  populate: {
                    avatar: true,
                  },
                },
              },
            },
            images: true,
            subcategories: true,
          },
        }
      );

      if (fullProduct) {
        await indexProduct(fullProduct);
        console.log(
          `✅ [LIFECYCLE] Product ${result.id} successfully updated in Elasticsearch`
        );
      } else {
        console.log(
          `⚠️ [LIFECYCLE] Product ${result.id} not found after update`
        );
      }
    } catch (error) {
      console.error(
        `❌ [LIFECYCLE] Failed to update product ${result.id} in Elasticsearch:`,
        {
          error: error.message,
          productId: result.id,
          productTitle: result.title,
          stack: error.stack,
        }
      );

      // Try to send failure notification
      try {
        const emailUtils = await import(
          "../../../../utils/email-notifications.js"
        );
        const { sendProductSyncFailureNotification } = emailUtils;
        await sendProductSyncFailureNotification(
          result.id,
          result.title || "Unknown",
          error.message
        );
        console.log(
          `📧 [LIFECYCLE] Email notification sent for product ${result.id} sync failure`
        );
      } catch (emailError) {
        console.error(
          "❌ [LIFECYCLE] Failed to send product sync failure notification:",
          emailError
        );
      }
    }
  },

  async afterDelete(event) {
    const { result } = event;
    console.log(`🔄 [LIFECYCLE] Product deleted: ${result.id}`);

    try {
      // Load elasticsearch functions dynamically
      const esUtils = await import("../../../../utils/elasticsearch.js");
      const { removeProduct } = esUtils;

      await removeProduct(result.id);
      console.log(
        `✅ [LIFECYCLE] Product ${result.id} successfully removed from Elasticsearch`
      );
    } catch (error) {
      console.error(
        `❌ [LIFECYCLE] Failed to remove product ${result.id} from Elasticsearch:`,
        {
          error: error.message,
          productId: result.id,
          productTitle: result.title,
          stack: error.stack,
        }
      );

      // Try to send failure notification
      try {
        const emailUtils = await import(
          "../../../../utils/email-notifications.js"
        );
        const { sendProductSyncFailureNotification } = emailUtils;
        await sendProductSyncFailureNotification(
          result.id,
          result.title || "Unknown",
          error.message
        );
        console.log(
          `📧 [LIFECYCLE] Email notification sent for product ${result.id} removal failure`
        );
      } catch (emailError) {
        console.error(
          "❌ [LIFECYCLE] Failed to send product removal failure notification:",
          emailError
        );
      }
    }
  },
};
