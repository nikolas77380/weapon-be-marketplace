/**
 * views service
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreService("api::view.view", ({ strapi }) => ({
  // Создание записи о просмотре (только если еще не просматривал)
  async createView(userId: string, productId: string) {
    try {
      // Проверяем, существует ли уже просмотр от этого пользователя
      const existingView = await strapi.entityService.findMany(
        "api::view.view",
        {
          filters: {
            userId,
            productId,
          },
          limit: 1,
        }
      );

      // Если просмотр уже существует, не создаем новый
      if (existingView && existingView.length > 0) {
        console.log(
          "View already exists for user:",
          userId,
          "product:",
          productId
        );
        return existingView[0];
      }

      // Создаем новый просмотр
      const view = await strapi.entityService.create("api::view.view", {
        data: {
          userId,
          productId,
          publishedAt: new Date(),
        },
      });

      console.log("New view created for user:", userId, "product:", productId);
      return view;
    } catch (error) {
      console.error("Error creating view:", error);
      throw error;
    }
  },

  // Получение количества уникальных просмотров для продукта
  async getProductViewsCount(productId: string) {
    try {
      const views = await strapi.entityService.findMany("api::view.view", {
        filters: { productId },
        fields: ["id"],
      });
      return views.length;
    } catch (error) {
      console.error("Error getting product views count:", error);
      return 0;
    }
  },

  // Получение просмотров пользователя
  async getUserViews(userId: string) {
    try {
      const views = await strapi.entityService.findMany("api::view.view", {
        filters: { userId },
        sort: { createdAt: "desc" },
      });
      return views;
    } catch (error) {
      console.error("Error getting user views:", error);
      return [];
    }
  },
}));
