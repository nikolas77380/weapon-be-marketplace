const { Client } = require("@elastic/elasticsearch");
const { createStrapi } = require("@strapi/strapi");
const path = require("path");

// Elasticsearch client configuration for Elastic Cloud
const createElasticsearchClient = () => {
  const node =
    process.env.ELASTICSEARCH_URL ||
    "https://your-cluster.es.region.aws.found.io:9243";
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && process.env.ELASTICSEARCH_API_KEY) {
    // Production configuration with API key for Elastic Cloud
    return new Client({
      node: node,
      auth: {
        apiKey: process.env.ELASTICSEARCH_API_KEY,
      },
    });
  } else {
    // Local development configuration
    return new Client({
      node: node,
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || "elastic",
        password: process.env.ELASTICSEARCH_PASSWORD || "changeme",
      },
    });
  }
};

const client = createElasticsearchClient();
const PRODUCTS_INDEX = process.env.ELASTICSEARCH_INDEX || "products";

// Product mapping optimized for Elastic Cloud
const productMapping = {
  properties: {
    id: { type: "integer" },
    title: {
      type: "text",
      analyzer: "standard",
      fields: {
        keyword: { type: "keyword" },
      },
    },
    slug: { type: "keyword" },
    sku: { type: "keyword" },
    description: {
      type: "text",
      analyzer: "standard",
    },
    price: { type: "float" },
    currency: { type: "keyword" },
    status: { type: "keyword" },
    viewsCount: { type: "integer" },
    createdAt: { type: "date" },
    updatedAt: { type: "date" },
    publishedAt: { type: "date" },
    // Category information
    category: {
      properties: {
        id: { type: "integer" },
        name: {
          type: "text",
          analyzer: "standard",
          fields: {
            keyword: { type: "keyword" },
          },
        },
        slug: { type: "keyword" },
        description: { type: "text" },
        parent: {
          properties: {
            id: { type: "integer" },
            name: { type: "text" },
            slug: { type: "keyword" },
          },
        },
      },
    },
    // Tags information
    tags: {
      type: "nested",
      properties: {
        id: { type: "integer" },
        name: {
          type: "text",
          analyzer: "standard",
          fields: {
            keyword: { type: "keyword" },
          },
        },
        slug: { type: "keyword" },
      },
    },
    // Seller information
    seller: {
      properties: {
        id: { type: "integer" },
        username: { type: "keyword" },
        email: { type: "keyword" },
        metadata: {
          properties: {
            companyName: { type: "text" },
            businessType: { type: "keyword" },
          },
        },
      },
    },
    // Images information
    images: {
      type: "nested",
      properties: {
        id: { type: "integer" },
        name: { type: "keyword" },
        url: { type: "keyword" },
        mime: { type: "keyword" },
        size: { type: "integer" },
      },
    },
    // Custom attributes
    attributesJson: { type: "object" },
    // Availability and condition
    availability: { type: "keyword" },
    condition: { type: "keyword" },
    // Category hierarchy for better filtering
    categoryHierarchy: {
      type: "nested",
      properties: {
        id: { type: "integer" },
        name: { type: "text" },
        slug: { type: "keyword" },
        description: { type: "text" },
      },
    },
    // Subcategories
    subcategories: {
      type: "nested",
      properties: {
        id: { type: "integer" },
        name: {
          type: "text",
          analyzer: "standard",
          fields: {
            keyword: { type: "keyword" },
          },
        },
        slug: { type: "keyword" },
        description: { type: "text" },
      },
    },
  },
};

async function initializeIndex() {
  try {
    console.log("🚀 Initializing Elasticsearch index for Elastic Cloud...");

    // Check if index exists
    const indexExists = await client.indices.exists({
      index: PRODUCTS_INDEX,
    });

    if (indexExists) {
      console.log(`📋 Index ${PRODUCTS_INDEX} already exists. Deleting...`);
      await client.indices.delete({
        index: PRODUCTS_INDEX,
      });
    }

    // Create index with mapping optimized for Elastic Cloud
    await client.indices.create({
      index: PRODUCTS_INDEX,
      mappings: productMapping,
    });

    console.log(`✅ Created Elasticsearch index: ${PRODUCTS_INDEX}`);
  } catch (error) {
    console.error("❌ Error initializing index:", error);
    throw error;
  }
}

async function syncProductsBulk() {
  try {
    console.log("🔄 Starting Strapi...");
    const app = await createStrapi({
      distDir: path.join(__dirname, "..", "dist"),
    }).load();

    console.log("📦 Fetching all products from Strapi...");

    // Get all products with populated relations
    const products = await app.entityService.findMany("api::product.product", {
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
      limit: -1, // Get all products
    });

    console.log(`📊 Found ${products.length} products to sync`);

    if (products.length === 0) {
      console.log("⚠️ No products found to sync");
      await app.destroy();
      return;
    }

    // Bulk indexing configuration
    const BATCH_SIZE = 1000; // Process 1000 products at a time
    const totalBatches = Math.ceil(products.length / BATCH_SIZE);

    console.log(
      `🔄 Processing ${totalBatches} batches of ${BATCH_SIZE} products each...`
    );

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, products.length);
      const batchProducts = products.slice(startIndex, endIndex);

      console.log(
        `📦 Processing batch ${batchIndex + 1}/${totalBatches} (products ${startIndex + 1}-${endIndex})`
      );

      // Prepare bulk body
      const bulkBody = [];

      for (const product of batchProducts) {
        try {
          // Build category hierarchy
          const categoryHierarchy = [];
          if (product.category) {
            categoryHierarchy.push({
              id: product.category.id,
              name: product.category.name,
              slug: product.category.slug,
              description: product.category.description,
            });

            if (product.category.parent) {
              categoryHierarchy.push({
                id: product.category.parent.id,
                name: product.category.parent.name,
                slug: product.category.parent.slug,
              });
            }
          }

          const document = {
            id: product.id,
            title: product.title,
            slug: product.slug,
            sku: product.sku,
            description: product.description,
            price: product.price,
            currency: product.currency,
            status: product.status,
            viewsCount: product.viewsCount || 0,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            publishedAt: product.publishedAt,
            category: product.category
              ? {
                  id: product.category.id,
                  name: product.category.name,
                  slug: product.category.slug,
                  description: product.category.description,
                  parent: product.category.parent
                    ? {
                        id: product.category.parent.id,
                        name: product.category.parent.name,
                        slug: product.category.parent.slug,
                      }
                    : null,
                }
              : null,
            categoryHierarchy: categoryHierarchy,
            tags: product.tags
              ? product.tags.map((tag) => ({
                  id: tag.id,
                  name: tag.name,
                  slug: tag.slug,
                }))
              : [],
            seller: product.seller
              ? {
                  id: product.seller.id,
                  username: product.seller.username,
                  email: product.seller.email,
                  metadata: product.seller.metadata
                    ? {
                        companyName: product.seller.metadata.companyName,
                        businessType: product.seller.metadata.businessType,
                      }
                    : null,
                }
              : null,
            images: product.images
              ? product.images.map((image) => ({
                  id: image.id,
                  name: image.name,
                  url: image.url,
                  mime: image.mime,
                  size: image.size,
                }))
              : [],
            subcategories: product.subcategories
              ? product.subcategories.map((subcat) => ({
                  id: subcat.id,
                  name: subcat.name,
                  slug: subcat.slug,
                  description: subcat.description,
                }))
              : [],
            attributesJson: product.attributesJson || {},
            availability:
              product.availability ||
              product.attributesJson?.availability ||
              "in_stock",
            condition:
              product.condition || product.attributesJson?.condition || "new",
          };

          // Add to bulk body
          bulkBody.push({
            index: {
              _index: PRODUCTS_INDEX,
              _id: product.id.toString(),
            },
          });
          bulkBody.push(document);
        } catch (error) {
          console.error(`❌ Error preparing product ${product.id}:`, error);
        }
      }

      // Execute bulk operation
      if (bulkBody.length > 0) {
        try {
          const response = await client.bulk({
            body: bulkBody,
            refresh: false, // Don't refresh after each batch for better performance
          });

          if (response.errors) {
            console.warn(
              `⚠️ Some errors in batch ${batchIndex + 1}:`,
              response.items.filter((item) => item.index.error)
            );
          }

          console.log(
            `✅ Batch ${batchIndex + 1}/${totalBatches} completed (${batchProducts.length} products)`
          );
        } catch (error) {
          console.error(`❌ Error in batch ${batchIndex + 1}:`, error);
        }
      }
    }

    // Final refresh to make all documents searchable
    console.log("🔄 Refreshing index to make documents searchable...");
    await client.indices.refresh({
      index: PRODUCTS_INDEX,
    });

    // Update replica settings for production
    console.log("⚙️ Updating index settings for production...");
    await client.indices.putSettings({
      index: PRODUCTS_INDEX,
    });

    console.log(
      `✅ Successfully synced ${products.length} products to Elasticsearch Cloud!`
    );

    // Close Strapi
    await app.destroy();
  } catch (error) {
    console.error("❌ Error syncing products:", error);
    throw error;
  }
}

async function main() {
  try {
    console.log("🚀 Starting Elasticsearch Cloud bulk sync...");
    console.log(
      `🌐 Target: ${process.env.ELASTICSEARCH_URL || "https://your-cluster.es.region.aws.found.io:9243"}`
    );
    console.log(`📋 Index: ${PRODUCTS_INDEX}`);

    const startTime = Date.now();

    await initializeIndex();
    await syncProductsBulk();

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log(
      `✅ Elasticsearch Cloud sync completed successfully in ${duration}s!`
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  initializeIndex,
  syncProductsBulk,
};
