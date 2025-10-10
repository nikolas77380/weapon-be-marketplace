import { factories } from "@strapi/strapi";
import {
  indexProduct,
  removeProduct,
  searchProducts,
  getProductAggregations,
  initializeElasticsearch,
} from "../../../utils/elasticsearch";

export default factories.createCoreService(
  "api::product.product",
  ({ strapi }) => ({
    // Initialize Elasticsearch on service start
    async initialize() {
      try {
        await initializeElasticsearch();
        console.log("Elasticsearch service initialized");
      } catch (error) {
        console.error("Failed to initialize Elasticsearch service:", error);
      }
    },

    // Index a product in Elasticsearch
    async indexProduct(productId: number) {
      try {
        const product = await strapi.entityService.findOne(
          "api::product.product",
          productId,
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
                  metadata: true,
                },
              },
              images: true,
            },
          }
        );

        if (product) {
          await indexProduct(product);
          return product;
        }
        return null;
      } catch (error) {
        console.error(`Error indexing product ${productId}:`, error);
        throw error;
      }
    },

    // Remove a product from Elasticsearch
    async removeProduct(productId: number) {
      try {
        await removeProduct(productId);
      } catch (error) {
        console.error(`Error removing product ${productId}:`, error);
        throw error;
      }
    },

    // Search products using Elasticsearch
    async searchProducts(query: any) {
      try {
        return await searchProducts(query, strapi);
      } catch (error) {
        console.error("Error searching products:", error);
        throw error;
      }
    },

    // Get product aggregations for filters
    async getProductAggregations(query: any) {
      try {
        return await getProductAggregations(query);
      } catch (error) {
        console.error("Error getting product aggregations:", error);
        throw error;
      }
    },
  })
);
