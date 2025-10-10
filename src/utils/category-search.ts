/**
 * Utility functions for category-based search in Elasticsearch
 */

/**
 * Get all category IDs that should be included in search
 * This includes the main category and all its subcategories
 */
export async function getAllCategoryIdsForSearch(
  strapi: any,
  categorySlug: string
): Promise<number[]> {
  try {
    // Find the main category by slug
    const categories = await strapi.entityService.findMany(
      "api::category.category",
      {
        filters: { slug: categorySlug },
        fields: ["id", "name", "slug"],
      }
    );

    if (!categories || categories.length === 0) {
      console.log(`Category with slug "${categorySlug}" not found`);
      return [];
    }

    const mainCategory = categories[0];
    console.log(
      `Found main category: ${mainCategory.name} (ID: ${mainCategory.id})`
    );

    // Get all child categories recursively
    const childCategoryIds = await getAllChildCategoryIds(
      strapi,
      mainCategory.id
    );

    // Return main category ID + all child category IDs
    const allCategoryIds = [mainCategory.id, ...childCategoryIds];
    console.log(`All category IDs for search: ${allCategoryIds.join(", ")}`);

    return allCategoryIds;
  } catch (error) {
    console.error("Error getting category IDs for search:", error);
    return [];
  }
}

/**
 * Recursively get all child category IDs
 */
async function getAllChildCategoryIds(
  strapi: any,
  categoryId: number
): Promise<number[]> {
  try {
    const childCategories = await strapi.entityService.findMany(
      "api::category.category",
      {
        filters: { parent: { id: { $eq: categoryId } } },
        fields: ["id", "name", "slug"],
      }
    );

    let allChildIds = childCategories.map((cat) => cat.id);

    // Recursively get child categories for each found category
    for (const childCategory of childCategories) {
      const grandChildIds = await getAllChildCategoryIds(
        strapi,
        childCategory.id
      );
      allChildIds = [...allChildIds, ...grandChildIds];
    }

    return allChildIds;
  } catch (error) {
    console.error(
      `Error getting child categories for category ${categoryId}:`,
      error
    );
    return [];
  }
}

/**
 * Build Elasticsearch query for category-based search
 */
export function buildCategorySearchQuery(categoryIds: number[]): any {
  if (categoryIds.length === 0) {
    return { match_all: {} };
  }

  return {
    bool: {
      should: [
        // Search by category ID
        { terms: { categoryId: categoryIds } },
        // Search by parent category ID
        { terms: { parentCategoryId: categoryIds } },
      ],
      minimum_should_match: 1,
    },
  };
}
