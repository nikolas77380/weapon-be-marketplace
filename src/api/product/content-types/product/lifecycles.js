const { indexProduct, removeProduct } = require("../../../../utils/elasticsearch");
const { sendProductSyncFailureNotification } = require("../../../../utils/email-notifications");

module.exports = {
  async afterCreate(event) {
    const { result } = event;
    console.log(`🔄 Product created: ${result.id} - ${result.title}`);
    
    try {
      // Get full product with relations for indexing
      const fullProduct = await strapi.entityService.findOne("api::product.product", result.id, {
        populate: {
          category: {
            populate: {
              parent: true,
            },
          },
          tags: true,
          seller: {
            populate: {
              metadata: true,
            },
          },
          images: true,
          subcategories: true,
        },
      });

      if (fullProduct) {
        await indexProduct(fullProduct);
        console.log(`✅ Product ${result.id} successfully indexed in Elasticsearch`);
      } else {
        console.log(`⚠️ Product ${result.id} not found after creation`);
      }
    } catch (error) {
      console.error(`❌ Failed to index product ${result.id}:`, {
        error: error.message,
        productId: result.id,
        productTitle: result.title
      });
      
      // Send failure notification
      try {
        await sendProductSyncFailureNotification(
          result.id,
          result.title || "Unknown",
          error.message
        );
        console.log(`📧 Email notification sent for product ${result.id} sync failure`);
      } catch (emailError) {
        console.error("❌ Failed to send product sync failure notification:", emailError);
      }
    }
  },

  async afterUpdate(event) {
    const { result } = event;
    console.log(`🔄 Product updated: ${result.id} - ${result.title}`);
    
    try {
      // Get full product with relations for indexing
      const fullProduct = await strapi.entityService.findOne("api::product.product", result.id, {
        populate: {
          category: {
            populate: {
              parent: true,
            },
          },
          tags: true,
          seller: {
            populate: {
              metadata: true,
            },
          },
          images: true,
          subcategories: true,
        },
      });

      if (fullProduct) {
        await indexProduct(fullProduct);
        console.log(`✅ Product ${result.id} successfully updated in Elasticsearch`);
      } else {
        console.log(`⚠️ Product ${result.id} not found after update`);
      }
    } catch (error) {
      console.error(`❌ Failed to update product ${result.id} in Elasticsearch:`, {
        error: error.message,
        productId: result.id,
        productTitle: result.title
      });
      
      // Send failure notification
      try {
        await sendProductSyncFailureNotification(
          result.id,
          result.title || "Unknown",
          error.message
        );
        console.log(`📧 Email notification sent for product ${result.id} sync failure`);
      } catch (emailError) {
        console.error("❌ Failed to send product sync failure notification:", emailError);
      }
    }
  },

  async afterDelete(event) {
    const { result } = event;
    console.log(`🔄 Product deleted: ${result.id}`);
    
    try {
      await removeProduct(result.id);
      console.log(`✅ Product ${result.id} successfully removed from Elasticsearch`);
    } catch (error) {
      console.error(`❌ Failed to remove product ${result.id} from Elasticsearch:`, {
        error: error.message,
        productId: result.id,
        productTitle: result.title
      });
      
      // Send failure notification
      try {
        await sendProductSyncFailureNotification(
          result.id,
          result.title || "Unknown",
          error.message
        );
        console.log(`📧 Email notification sent for product ${result.id} removal failure`);
      } catch (emailError) {
        console.error("❌ Failed to send product removal failure notification:", emailError);
      }
    }
  },
};
