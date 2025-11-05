import { Client } from "@elastic/elasticsearch";
import {
  getAllCategoryIdsForSearch,
  buildCategorySearchQuery,
} from "./category-search";

// Elasticsearch client configuration
// Prefer API key auth whenever provided; otherwise fall back to basic auth
const createElasticsearchClient = () => {
  const node = process.env.ELASTICSEARCH_URL || "http://localhost:9200";

  if (process.env.ELASTICSEARCH_API_KEY) {
    return new Client({
      node,
      auth: { apiKey: process.env.ELASTICSEARCH_API_KEY },
    });
  }

  return new Client({
    node,
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME || "elastic",
      password: process.env.ELASTICSEARCH_PASSWORD || "changeme",
    },
  });
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
    priceUSD: { type: "float" },
    priceEUR: { type: "float" },
    priceUAH: { type: "float" },
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
        avatarUrl: { type: "keyword" },
        country: { type: "keyword" },
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
    // Condition
    condition: { type: "keyword" },
    // Video URL
    videoUrl: { type: "keyword" },
    // Simple category fields for new approach
    categoryId: { type: "integer" },
    categoryName: { type: "keyword" },
    categorySlug: { type: "keyword" },
    parentCategoryId: { type: "integer" },
    parentCategoryName: { type: "keyword" },
    parentCategorySlug: { type: "keyword" },
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
  console.log(
    `🔍 Checking Elasticsearch connection and index: ${PRODUCTS_INDEX}`
  );

  try {
    // Test connection first
    const health = await client.cluster.health();
    console.log(`📊 Elasticsearch cluster health:`, {
      status: health.status,
      number_of_nodes: health.number_of_nodes,
      active_primary_shards: health.active_primary_shards,
    });

    // Check if index exists
    const indexExists = await client.indices.exists({
      index: PRODUCTS_INDEX,
    });

    if (!indexExists) {
      console.log(`📝 Creating new Elasticsearch index: ${PRODUCTS_INDEX}`);
      // Create index with mapping
      await client.indices.create({
        index: PRODUCTS_INDEX,
        mappings: productMapping,
      });
      console.log(`✅ Created Elasticsearch index: ${PRODUCTS_INDEX}`);
    } else {
      console.log(`✅ Elasticsearch index ${PRODUCTS_INDEX} already exists`);
    }
  } catch (error) {
    console.error("❌ Error initializing Elasticsearch:", {
      error: error.message,
      stack: error.stack,
      index: PRODUCTS_INDEX,
    });
    throw error;
  }
}

// Index a product in Elasticsearch
export async function indexProduct(product: any) {
  console.log(`🔄 Starting to index product ${product.id}: ${product.title}`);
  console.log(`💰 Price data:`, {
    price: product.price,
    priceUSD: product.priceUSD,
    priceEUR: product.priceEUR,
    priceUAH: product.priceUAH,
  });

  try {
    const document = {
      id: product.id,
      title: product.title,
      slug: product.slug,
      sku: product.sku,
      description: product.description,
      // Keep legacy price for backward compatibility in index, but do not use as fallback
      price: product.price ?? 0,
      priceUSD: product.priceUSD ?? 0,
      priceEUR: product.priceEUR ?? 0,
      priceUAH: product.priceUAH ?? 0,
      currency: product.currency || "USD",
      status: product.status || "available",
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
      // Simple category fields for filtering
      categoryId: product.category?.id || null,
      categoryName: product.category?.name || null,
      categorySlug: product.category?.slug || null,
      parentCategoryId: product.category?.parent?.id || null,
      parentCategoryName: product.category?.parent?.name || null,
      parentCategorySlug: product.category?.parent?.slug || null,
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
            avatarUrl: product.seller.metadata?.avatar?.url || null,
            country: product.seller.metadata?.country || null,
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
      condition: product.condition || "new",
      videoUrl: product.videoUrl || null,
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

    console.log(`📝 Document prepared for product ${product.id}:`, {
      id: document.id,
      title: document.title,
      category: document.category?.name,
      categoryId: document.categoryId,
      categorySlug: document.categorySlug,
      seller: document.seller?.username,
      tags: document.tags?.length || 0,
      images: document.images?.length || 0,
    });

    const result = await client.index({
      index: PRODUCTS_INDEX,
      id: product.id.toString(),
      document: document,
    });

    console.log(
      `✅ Successfully indexed product ${product.id} in Elasticsearch:`,
      {
        result: result.result,
        id: result._id,
        index: result._index,
      }
    );
  } catch (error) {
    console.error(`❌ Failed to index product ${product.id}:`, {
      error: error.message,
      stack: error.stack,
      productId: product.id,
      productTitle: product.title,
    });
    throw error;
  }
}

// Remove a product from Elasticsearch
export async function removeProduct(productId: number) {
  console.log(`🗑️ Starting to remove product ${productId} from Elasticsearch`);

  try {
    const result = await client.delete({
      index: PRODUCTS_INDEX,
      id: productId.toString(),
    });

    console.log(
      `✅ Successfully removed product ${productId} from Elasticsearch:`,
      {
        result: result.result,
        id: result._id,
        index: result._index,
      }
    );
  } catch (error) {
    if (error.meta?.statusCode === 404) {
      console.log(`⚠️ Product ${productId} not found in Elasticsearch (404)`);
    } else {
      console.error(`❌ Failed to remove product ${productId}:`, {
        error: error.message,
        statusCode: error.meta?.statusCode,
        productId: productId,
      });
      throw error;
    }
  }
}

// Search products in Elasticsearch
export async function searchProducts(query: any, strapi?: any) {
  console.log(`🔍 Searching products in Elasticsearch:`, {
    searchTerm: query.searchTerm,
    categorySlug: query.categorySlug,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
  });

  try {
    const {
      searchTerm = "",
      categorySlug,
      priceRange,
      currency, // optional; when omitted we won't hard-filter by currency
      tags,
      status = "published",
      sort = "createdAt:desc",
      page = 1,
      pageSize = 10,
      availability,
      condition,
      categories,
    } = query;

    // Build search query - no status filter to show all products
    const searchQuery: any = {
      bool: {
        must: [],
      },
    };

    // No status filtering (return all statuses)

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
    // Only apply main category filter if no specific categories filter is provided
    if (categorySlug && strapi && (!categories || categories.length === 0)) {
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
      // Determine which price field to use based on currency
      const priceField =
        currency === "USD"
          ? "priceUSD"
          : currency === "EUR"
            ? "priceEUR"
            : currency === "UAH"
              ? "priceUAH"
              : "price"; // legacy fallback when currency is not provided

      const priceFilter: any = { range: { [priceField]: {} } };
      if (priceRange.min !== undefined) {
        priceFilter.range[priceField].gte = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        priceFilter.range[priceField].lte = priceRange.max;
      }
      searchQuery.bool.must.push(priceFilter);
    }

    // Do not filter by currency; use it only to select price field

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

    // Add status filter
    if (availability && availability.length > 0) {
      searchQuery.bool.must.push({
        terms: { status: availability },
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
        terms: { categorySlug: categories },
      });
    }

    // Build sort
    const sortArray = [];
    if (sort) {
      const [field, order] = sort.split(":");
      let sortField = field;

      // For text fields that have keyword subfields, use keyword for sorting
      if (field === "title") {
        sortField = "title.keyword";
      } else if (field === "category.name") {
        sortField = "category.name.keyword";
      } else if (field === "seller.metadata.companyName") {
        sortField = "seller.metadata.companyName.keyword";
      } else if (field === "description") {
        sortField = "description.keyword";
      } else if (field === "slug") {
        sortField = "slug";
      } else if (field === "sku") {
        sortField = "sku";
      } else if (field === "status") {
        sortField = "status";
      } else if (field === "status") {
        sortField = "status";
      } else if (field === "condition") {
        sortField = "condition";
      } else if (field === "price") {
        // Use currency-specific price field for sorting
        sortField =
          currency === "USD"
            ? "priceUSD"
            : currency === "EUR"
              ? "priceEUR"
              : currency === "UAH"
                ? "priceUAH"
                : "price";
      }

      sortArray.push({ [sortField]: order });
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

    const result = {
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

    console.log(`✅ Search completed:`, {
      total: result.total,
      hits: result.hits.length,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
    });

    return result;
  } catch (error) {
    console.error("❌ Error searching products in Elasticsearch:", error);
    throw error;
  }
}

// Get aggregations for filters
export async function getProductAggregations(query: any, strapi?: any) {
  try {
    const {
      categorySlug,
      priceRange,
      currency = "USD",
      tags,
      status = "published",
      availability,
      condition,
      categories,
    } = query;

    // Build base query - no status filter to show all products
    const searchQuery: any = {
      bool: {
        must: [],
      },
    };

    // Add category filter using simplified approach
    // Only apply main category filter if no specific categories filter is provided
    if (categorySlug && (!categories || categories.length === 0)) {
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
          // If no categories found, return empty aggregations
          return {
            categories: [],
            tags: [],
            priceStats: { count: 0, min: null, max: null, avg: null, sum: 0 },
            priceHistogram: [],
            availability: [],
            condition: [],
            subcategories: [],
          };
        }
      } catch (error) {
        console.error("Error getting category IDs for aggregations:", error);
        // Continue without category filter if there's an error
      }
    }

    // No status filtering for aggregations

    // Add status filter
    if (availability && availability.length > 0) {
      searchQuery.bool.must.push({
        terms: { status: availability },
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
        terms: { categorySlug: categories },
      });
    }

    // Add tags filter
    if (tags && tags.length > 0) {
      searchQuery.bool.must.push({
        terms: { tags: tags },
      });
    }

    // Do NOT filter by currency for aggregations; return all currencies

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
            field: "categorySlug",
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
        // Stats for all currencies in parallel
        price_stats_usd: {
          filter: { range: { priceUSD: { gt: 0 } } },
          aggs: { stats: { stats: { field: "priceUSD" } } },
        },
        price_stats_eur: {
          filter: { range: { priceEUR: { gt: 0 } } },
          aggs: { stats: { stats: { field: "priceEUR" } } },
        },
        price_stats_uah: {
          filter: { range: { priceUAH: { gt: 0 } } },
          aggs: { stats: { stats: { field: "priceUAH" } } },
        },
        status: {
          terms: {
            field: "status",
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

    const statsUSD = (response.aggregations.price_stats_usd as any)?.stats;
    const statsEUR = (response.aggregations.price_stats_eur as any)?.stats;
    const statsUAH = (response.aggregations.price_stats_uah as any)?.stats;

    const toStats = (s: any) =>
      s
        ? {
            count: s.count || 0,
            min: s.min ?? s.min_value ?? 0,
            max: s.max ?? s.max_value ?? 0,
            avg: s.avg ?? 0,
            sum: s.sum ?? 0,
          }
        : { count: 0, min: 0, max: 0, avg: 0, sum: 0 };

    const priceStatsByCurrency = {
      USD: toStats(statsUSD),
      EUR: toStats(statsEUR),
      UAH: toStats(statsUAH),
    };

    return {
      categories: (response.aggregations.categories as any).buckets,
      tags: (response.aggregations.tags as any).tag_terms.buckets,
      // Keep backward key 'priceStats' selecting current currency if needed
      priceStats: priceStatsByCurrency[currency as "USD" | "EUR" | "UAH"] || {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        sum: 0,
      },
      priceStatsByCurrency,
      availability: (response.aggregations.status as any).buckets,
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
      currency = "USD",
      tags,
      status = "available",
      sort = "createdAt:desc",
      page = 1,
      pageSize = 10,
      availability,
      condition,
      categories,
    } = query;

    // Build search query - no status filter to show all products
    const searchQuery: any = {
      bool: {
        must: [
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
      // Determine which price field to use based on currency
      const priceField =
        currency === "USD"
          ? "priceUSD"
          : currency === "EUR"
            ? "priceEUR"
            : currency === "UAH"
              ? "priceUAH"
              : "price";

      const priceFilter: any = { range: { [priceField]: {} } };
      if (priceRange.min !== undefined) {
        priceFilter.range[priceField].gte = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        priceFilter.range[priceField].lte = priceRange.max;
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

    // Add status filter
    if (availability && availability.length > 0) {
      searchQuery.bool.must.push({
        terms: { status: availability },
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
        terms: { categorySlug: categories },
      });
    }

    // Build sort
    const sortArray = [];
    if (sort) {
      const [field, order] = sort.split(":");
      let sortField = field;

      // For text fields that have keyword subfields, use keyword for sorting
      if (field === "title") {
        sortField = "title.keyword";
      } else if (field === "category.name") {
        sortField = "category.name.keyword";
      } else if (field === "seller.metadata.companyName") {
        sortField = "seller.metadata.companyName.keyword";
      } else if (field === "description") {
        sortField = "description.keyword";
      } else if (field === "slug") {
        sortField = "slug";
      } else if (field === "sku") {
        sortField = "sku";
      } else if (field === "status") {
        sortField = "status";
      } else if (field === "status") {
        sortField = "status";
      } else if (field === "condition") {
        sortField = "condition";
      } else if (field === "price") {
        // Use currency-specific price field for sorting
        sortField =
          currency === "USD"
            ? "priceUSD"
            : currency === "EUR"
              ? "priceEUR"
              : currency === "UAH"
                ? "priceUAH"
                : "price";
      }

      sortArray.push({ [sortField]: order });
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
      currency = "USD",
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
            term: { "seller.id": sellerId },
          },
        ],
      },
    };

    // Add status filter
    if (availability && availability.length > 0) {
      searchQuery.bool.must.push({
        terms: { status: availability },
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
        terms: { categorySlug: categories },
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
            field: "categorySlug",
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
        // Keep only non-histogram aggregations for seller view
        status: {
          terms: {
            field: "status",
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

    const priceStatsData = (response.aggregations.price_stats as any)?.stats;
    console.log(`💰 Seller price stats for currency ${currency}:`, {
      count: priceStatsData?.count,
      min: priceStatsData?.min,
      max: priceStatsData?.max,
      avg: priceStatsData?.avg,
      sum: priceStatsData?.sum,
      raw: response.aggregations.price_stats,
    });

    // Ensure priceStats has valid min/max values
    const priceStats = priceStatsData
      ? {
          count: priceStatsData.count || 0,
          min: priceStatsData.min ?? priceStatsData.min_value ?? 0,
          max: priceStatsData.max ?? priceStatsData.max_value ?? 100000,
          avg: priceStatsData.avg ?? 0,
          sum: priceStatsData.sum ?? 0,
        }
      : {
          count: 0,
          min: 0,
          max: 100000,
          avg: 0,
          sum: 0,
        };

    return {
      categories: (response.aggregations.categories as any).buckets,
      tags: (response.aggregations.tags as any).tag_terms.buckets,
      priceStats: priceStats,
      availability: (response.aggregations.status as any).buckets,
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
