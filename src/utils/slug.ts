/**
 * Утилита для генерации slug
 */

/**
 * Генерирует slug из заголовка
 * @param title - Заголовок для преобразования в slug
 * @returns Строка slug
 */
export function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      // Заменяем все не-буквенно-цифровые символы на дефисы
      .replace(/[^a-z0-9\s-]/g, "")
      // Заменяем пробелы на дефисы
      .replace(/\s+/g, "-")
      // Убираем множественные дефисы
      .replace(/-+/g, "-")
      // Убираем дефисы в начале и конце
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * Генерирует уникальный slug
 * @param strapi - Экземпляр Strapi
 * @param title - Заголовок для преобразования в slug
 * @param excludeId - ID записи для исключения при проверке уникальности (для обновления)
 * @returns Уникальный slug
 */
export async function generateUniqueSlug(
  strapi: any,
  title: string,
  excludeId?: string | number
): Promise<string> {
  let baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  // Проверяем уникальность slug
  while (true) {
    const query: any = {
      filters: {
        slug: slug,
      },
    };

    // Исключаем текущий продукт при обновлении
    if (excludeId) {
      query.filters.$not = {
        id: excludeId,
      };
    }

    const existingProducts = await strapi.entityService.findMany(
      "api::product.product",
      query
    );

    if (existingProducts.length === 0) {
      break; // Slug уникален
    }

    // Добавляем счетчик к slug
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
