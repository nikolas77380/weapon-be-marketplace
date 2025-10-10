import { Client } from "@elastic/elasticsearch";
import {
  getAllCategoryIdsForSearch,
  buildCategorySearchQuery,
} from "./category-search";

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
export const PRODUCTS_INDEX = process.env.ELASTICSEARCH_INDEX || "products";

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
      availability:
        product.availability ||
        product.attributesJson?.availability ||
        "in_stock",
      condition:
        product.condition || product.attributesJson?.condition || "new",
      // Build category hierarchy for better filtering
      categoryHierarchy: (() => {
        const hierarchy = [];
        if (product.category) {
          hierarchy.push({
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
            description: product.category.description,
          });

          if (product.category.parent) {
            hierarchy.push({
              id: product.category.parent.id,
              name: product.category.parent.name,
              slug: product.category.parent.slug,
            });
          }
        }
        return hierarchy;
      })(),
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
export async function searchProducts(query: any, strapi?: any) {
  try {
    const {
      searchTerm = "",
      categorySlug,
      priceRange,
      tags,
      status = "published",
      sort = "createdAt:desc",
      page = 1,
      pageSize = 10,
      availability,
      condition,
      categories,
    } = query;

    // Build search query
    const searchQuery: any = {
      bool: {
        must: [
          {
            terms: { status: ["published", "available"] },
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

    // Add category filter using simplified approach
    if (categorySlug && strapi) {
      try {
        // Get all category IDs that should be included in search
        const categoryIds = await getAllCategoryIdsForSearch(
          strapi,
          categorySlug
        );

        if (categoryIds.length > 0) {
          // Use the simplified category search query
          const categoryQuery = buildCategorySearchQuery(categoryIds);
          searchQuery.bool.must.push(categoryQuery);
        } else {
          // If no categories found, return empty results
          return {
            hits: [],
            total: 0,
            page,
            pageSize,
            pageCount: 0,
          };
        }
      } catch (error) {
        console.error("Error getting category IDs for search:", error);
        // Continue without category filter if there's an error
      }
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

    // Add availability filter
    if (availability && availability.length > 0) {
      searchQuery.bool.must.push({
        terms: { availability: availability },
      });
    }

    // Add condition filter
    if (condition && condition.length > 0) {
      searchQuery.bool.must.push({
        terms: { condition: condition },
      });
    }

    // Add categories filter
    if (categories && categories.length > 0) {
      searchQuery.bool.must.push({
        terms: { "category.slug": categories },
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
    const {
      categorySlug,
      priceRange,
      tags,
      status = "published",
      availability,
      condition,
      categories,
    } = query;

    // Build base query (same as search)
    const searchQuery: any = {
      bool: {
        must: [
          {
            terms: { status: ["published", "available"] },
          },
        ],
      },
    };

    if (categorySlug) {
      // For "weapons" category, we need to find all products that belong to weapons or its subcategories
      if (categorySlug === "weapons") {
        searchQuery.bool.must.push({
          bool: {
            should: [
              { term: { "category.slug": categorySlug } },
              { term: { "category.parent.slug": categorySlug } },
              { term: { "category.parent.name": categorySlug } },
              // Include products from "small-arms" category (which is a subcategory of "weapons")
              { term: { "category.slug": "small-arms" } },
              { term: { "category.parent.slug": "small-arms" } },
              { term: { "category.parent.name": "Small Arms" } },
              // Include products from "submachine-guns" category (which is a subcategory of "small-arms")
              { term: { "category.slug": "submachine-guns" } },
              { term: { "category.parent.slug": "submachine-guns" } },
              { term: { "category.parent.name": "Submachine Guns (SMG)" } },
              // Include products from "anti-tank-anti-material" category (which is a subcategory of "weapons")
              { term: { "category.slug": "anti-tank-anti-material" } },
              { term: { "category.parent.slug": "anti-tank-anti-material" } },
              {
                term: {
                  "category.parent.name":
                    "Anti-tank/Anti-material Small Unit Weapons",
                },
              },
            ],
            minimum_should_match: 1,
          },
        });
      } else {
        // For other categories, use the standard search
        searchQuery.bool.must.push({
          bool: {
            should: [
              { term: { "category.slug": categorySlug } },
              { term: { "category.parent.slug": categorySlug } },
              { term: { "category.parent.name": categorySlug } },
            ],
            minimum_should_match: 1,
          },
        });
      }
    }

    // Add availability filter
    if (availability && availability.length > 0) {
      searchQuery.bool.must.push({
        terms: { availability: availability },
      });
    }

    // Add condition filter
    if (condition && condition.length > 0) {
      searchQuery.bool.must.push({
        terms: { condition: condition },
      });
    }

    // Add categories filter
    if (categories && categories.length > 0) {
      searchQuery.bool.must.push({
        terms: { "category.slug": categories },
      });
    }

    // Add tags filter
    if (tags && tags.length > 0) {
      searchQuery.bool.must.push({
        terms: { tags: tags },
      });
    }

    // Note: We don't apply priceRange filter to aggregations query
    // because we want to show the full price range for the category
    // The priceRange filter should only be applied to the main search query
    // if (priceRange) {
    //   const priceFilter: any = { range: { price: {} } };
    //   if (priceRange.min !== undefined) {
    //     priceFilter.range.price.gte = priceRange.min;
    //   }
    //   if (priceRange.max !== undefined) {
    //     priceFilter.range.price.lte = priceRange.max;
    //   }
    //   searchQuery.bool.must.push(priceFilter);
    // }

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

// Search products by seller in Elasticsearch
export async function searchProductsBySeller(query: any) {
  try {
    const {
      searchTerm = "",
      sellerId,
      priceRange,
      tags,
      status = "available",
      sort = "createdAt:desc",
      page = 1,
      pageSize = 10,
      availability,
      condition,
      categories,
    } = query;

    // Build search query
    const searchQuery: any = {
      bool: {
        must: [
          {
            terms: { status: ["published", "available"] },
          },
          {
            term: { "seller.id": sellerId },
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

    // Add availability filter
    if (availability && availability.length > 0) {
      searchQuery.bool.must.push({
        terms: { availability: availability },
      });
    }

    // Add condition filter
    if (condition && condition.length > 0) {
      searchQuery.bool.must.push({
        terms: { condition: condition },
      });
    }

    // Add categories filter
    if (categories && categories.length > 0) {
      searchQuery.bool.must.push({
        terms: { "category.slug": categories },
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
    console.error(
      "Error searching products by seller in Elasticsearch:",
      error
    );
    throw error;
  }
}

// Get aggregations for seller products
export async function getSellerProductAggregations(query: any) {
  try {
    const {
      sellerId,
      priceRange,
      tags,
      status = "published",
      availability,
      condition,
      categories,
    } = query;

    // Build base query (same as search)
    const searchQuery: any = {
      bool: {
        must: [
          {
            terms: { status: ["published", "available"] },
          },
          {
            term: { "seller.id": sellerId },
          },
        ],
      },
    };

    // Add availability filter
    if (availability && availability.length > 0) {
      searchQuery.bool.must.push({
        terms: { availability: availability },
      });
    }

    // Add condition filter
    if (condition && condition.length > 0) {
      searchQuery.bool.must.push({
        terms: { condition: condition },
      });
    }

    // Add categories filter
    if (categories && categories.length > 0) {
      searchQuery.bool.must.push({
        terms: { "category.slug": categories },
      });
    }

    // Add tags filter
    if (tags && tags.length > 0) {
      searchQuery.bool.must.push({
        terms: { tags: tags },
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
    console.error("Error getting seller product aggregations:", error);
    throw error;
  }
}

export default client;
