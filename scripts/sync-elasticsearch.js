const { Client } = require("@elastic/elasticsearch");
const { createStrapi } = require("@strapi/strapi");
const path = require("path");

// Elasticsearch client configuration
const client = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || "elastic",
    password: process.env.ELASTICSEARCH_PASSWORD || "changeme",
  },
});

const PRODUCTS_INDEX = "products";

// Product mapping for Elasticsearch
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
  },
};

async function initializeIndex() {
  try {
    console.log("Initializing Elasticsearch index...");

    // Check if index exists
    const indexExists = await client.indices.exists({
      index: PRODUCTS_INDEX,
    });

    if (indexExists) {
      console.log(`Index ${PRODUCTS_INDEX} already exists. Deleting...`);
      await client.indices.delete({
        index: PRODUCTS_INDEX,
      });
    }

    // Create index with mapping
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

async function syncProducts() {
  try {
    console.log("Starting Strapi...");
    const app = await createStrapi({
      distDir: path.join(__dirname, "..", "dist"),
    }).load();

    console.log("Fetching all products from Strapi...");

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
      },
      limit: -1, // Get all products
    });

    console.log(`Found ${products.length} products to sync`);

    // Index each product
    for (const product of products) {
      try {
        // Build category hierarchy - include all parent categories
        const categoryHierarchy = [];
        if (product.category) {
          // Add current category
          categoryHierarchy.push({
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
            description: product.category.description,
          });

          // Add parent category
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
          // Add category hierarchy for better filtering
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
          attributesJson: product.attributesJson || {},
        };

        await client.index({
          index: PRODUCTS_INDEX,
          id: product.id.toString(),
          document: document,
        });

        console.log(`✅ Indexed product ${product.id}: ${product.title}`);
      } catch (error) {
        console.error(`❌ Error indexing product ${product.id}:`, error);
      }
    }

    console.log(
      `✅ Successfully synced ${products.length} products to Elasticsearch`
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
    console.log("🚀 Starting Elasticsearch sync...");

    await initializeIndex();
    await syncProducts();

    console.log("✅ Elasticsearch sync completed successfully!");
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
  syncProducts,
};
