import { Client } from "@elastic/elasticsearch";

// Elasticsearch client configuration
// For production: use API key authentication
// For local development: use username/password authentication
const createElasticsearchClient = () => {
  const node = process.env.ELASTICSEARCH_URL || "http://localhost:9200";
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && process.env.ELASTICSEARCH_API_KEY) {
    // Production configuration with API key
    return new Client({
      node: node,
      auth: {
        apiKey: process.env.ELASTICSEARCH_API_KEY,
      },
    });
  } else {
    // Local development configuration with username/password
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

// Product index name
export const PRODUCTS_INDEX = "products";

// Product mapping for Elasticsearch
export const productMapping: any = {
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

// Initialize Elasticsearch index
export async function initializeElasticsearch() {
  try {
    // Check if index exists
    const indexExists = await client.indices.exists({
      index: PRODUCTS_INDEX,
    });

    if (!indexExists) {
      // Create index with mapping
      await client.indices.create({
        index: PRODUCTS_INDEX,
        mappings: productMapping,
      });
      console.log(`Created Elasticsearch index: ${PRODUCTS_INDEX}`);
    } else {
      console.log(`Elasticsearch index ${PRODUCTS_INDEX} already exists`);
    }
  } catch (error) {
    console.error("Error initializing Elasticsearch:", error);
    throw error;
  }
}

// Index a product in Elasticsearch
export async function indexProduct(product: any) {
  try {
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
      tags: product.tags
        ? product.tags.map((tag: any) => ({
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
        ? product.images.map((image: any) => ({
            id: image.id,
            name: image.name,
            url: image.url,
            mime: image.mime,
            size: image.size,
          }))
        : [],
      attributesJson: product.attributesJson || {},
      availability: product.availability || "in_stock",
      condition: product.condition || "new",
      subcategories: product.subcategories
        ? product.subcategories.map((subcat: any) => ({
            id: subcat.id,
            name: subcat.name,
            slug: subcat.slug,
            description: subcat.description,
          }))
        : [],
    };

    await client.index({
      index: PRODUCTS_INDEX,
      id: product.id.toString(),
      document: document,
    });

    console.log(`Indexed product ${product.id} in Elasticsearch`);
  } catch (error) {
    console.error(`Error indexing product ${product.id}:`, error);
    throw error;
  }
}

// Remove a product from Elasticsearch
export async function removeProduct(productId: number) {
  try {
    await client.delete({
      index: PRODUCTS_INDEX,
      id: productId.toString(),
    });
    console.log(`Removed product ${productId} from Elasticsearch`);
  } catch (error) {
    if (error.meta?.statusCode === 404) {
      console.log(`Product ${productId} not found in Elasticsearch`);
    } else {
      console.error(`Error removing product ${productId}:`, error);
      throw error;
    }
  }
}

// Search products in Elasticsearch
export async function searchProducts(query: any) {
  try {
    const {
      searchTerm = "",
      categorySlug,
      priceRange,
      tags,
      status = "available",
      sort = "createdAt:desc",
      page = 1,
      pageSize = 10,
    } = query;

    // Build search query
    const searchQuery: any = {
      bool: {
        must: [
          {
            term: { status },
          },
        ],
      },
    };

    // Add text search
    if (searchTerm && searchTerm.trim()) {
      searchQuery.bool.must.push({
        multi_match: {
          query: searchTerm.trim(),
          fields: ["title^2", "description", "category.name", "tags.name"],
          type: "best_fields",
          fuzziness: "AUTO",
        },
      });
    }

    // Add category filter
    if (categorySlug) {
      searchQuery.bool.must.push({
        term: { "category.slug": categorySlug },
      });
    }

    // Add price range filter
    if (priceRange) {
      const priceFilter: any = { range: { price: {} } };
      if (priceRange.min !== undefined) {
        priceFilter.range.price.gte = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        priceFilter.range.price.lte = priceRange.max;
      }
      searchQuery.bool.must.push(priceFilter);
    }

    // Add tags filter
    if (tags && tags.length > 0) {
      searchQuery.bool.must.push({
        nested: {
          path: "tags",
          query: {
            terms: { "tags.slug": tags },
          },
        },
      });
    }

    // Build sort
    const sortArray = [];
    if (sort) {
      const [field, order] = sort.split(":");
      sortArray.push({ [field]: order });
    }

    // Execute search
    const response = await client.search({
      index: PRODUCTS_INDEX,
      query: searchQuery,
      sort: sortArray,
      from: (page - 1) * pageSize,
      size: pageSize,
      _source: true,
    });

    return {
      hits: response.hits.hits.map((hit: any) => hit._source),
      total:
        typeof response.hits.total === "number"
          ? response.hits.total
          : response.hits.total.value,
      page,
      pageSize,
      pageCount: Math.ceil(
        (typeof response.hits.total === "number"
          ? response.hits.total
          : response.hits.total.value) / pageSize
      ),
    };
  } catch (error) {
    console.error("Error searching products in Elasticsearch:", error);
    throw error;
  }
}

// Get aggregations for filters
export async function getProductAggregations(query: any) {
  try {
    const { categorySlug, priceRange, tags, status = "available" } = query;

    // Build base query (same as search)
    const searchQuery: any = {
      bool: {
        must: [
          {
            term: { status },
          },
        ],
      },
    };

    if (categorySlug) {
      searchQuery.bool.must.push({
        term: { "category.slug": categorySlug },
      });
    }

    if (priceRange) {
      const priceFilter: any = { range: { price: {} } };
      if (priceRange.min !== undefined) {
        priceFilter.range.price.gte = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        priceFilter.range.price.lte = priceRange.max;
      }
      searchQuery.bool.must.push(priceFilter);
    }

    if (tags && tags.length > 0) {
      searchQuery.bool.must.push({
        nested: {
          path: "tags",
          query: {
            terms: { "tags.slug": tags },
          },
        },
      });
    }

    const response = await client.search({
      index: PRODUCTS_INDEX,
      query: searchQuery,
      size: 0,
      aggs: {
        categories: {
          terms: {
            field: "category.slug",
            size: 100,
          },
        },
        tags: {
          nested: {
            path: "tags",
          },
          aggs: {
            tag_terms: {
              terms: {
                field: "tags.slug",
                size: 100,
              },
            },
          },
        },
        price_stats: {
          stats: {
            field: "price",
          },
        },
        price_histogram: {
          histogram: {
            field: "price",
            interval: 100,
          },
        },
        availability: {
          terms: {
            field: "availability",
            size: 20,
          },
        },
        condition: {
          terms: {
            field: "condition",
            size: 20,
          },
        },
        subcategories: {
          nested: {
            path: "subcategories",
          },
          aggs: {
            subcategory_terms: {
              terms: {
                field: "subcategories.slug",
                size: 100,
              },
            },
          },
        },
      },
    });

    return {
      categories: (response.aggregations.categories as any).buckets,
      tags: (response.aggregations.tags as any).tag_terms.buckets,
      priceStats: response.aggregations.price_stats,
      priceHistogram: (response.aggregations.price_histogram as any).buckets,
      availability: (response.aggregations.availability as any).buckets,
      condition: (response.aggregations.condition as any).buckets,
      subcategories: (response.aggregations.subcategories as any)
        .subcategory_terms.buckets,
    };
  } catch (error) {
    console.error("Error getting product aggregations:", error);
    throw error;
  }
}

export default client;
