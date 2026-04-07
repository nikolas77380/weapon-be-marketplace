/**
 * Helper function to filter seller fields, returning only id, username, companyName, avatarUrl, and country
 */
export function filterSellerFields(seller: any): any {
  if (!seller) {
    return seller;
  }

  const filteredSeller: any = {
    id: seller.id,
    username: seller.username,
  };

  // Get companyName from metadata if available
  if (seller.metadata && seller.metadata.companyName) {
    filteredSeller.companyName = seller.metadata.companyName;
  }

  // Get avatarUrl from metadata if available
  if (seller.metadata && seller.metadata.avatar?.url) {
    filteredSeller.avatarUrl = seller.metadata.avatar.url;
    filteredSeller.avatar = seller.metadata.avatar;
  }

  // Get country from metadata if available
  if (seller.metadata && seller.metadata.country) {
    filteredSeller.country = seller.metadata.country;
  }

  return filteredSeller;
}

/**
 * Helper function to sanitize product seller fields
 */
export function sanitizeProductSeller(product: any): any {
  if (!product) {
    return product;
  }

  if (product.seller) {
    product.seller = filterSellerFields(product.seller);
  }

  return product;
}

/**
 * Helper function to sanitize array of products
 */
export function sanitizeProducts(products: any[]): any[] {
  if (!Array.isArray(products)) {
    return products;
  }

  return products.map((product) => sanitizeProductSeller(product));
}
