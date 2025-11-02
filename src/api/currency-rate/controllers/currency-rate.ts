/**
 * currency-rate controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::currency-rate.currency-rate" as any,
  ({ strapi }) => ({
    /**
     * Get latest currency rates
     * Automatically updates from fixer.io if last update was more than 24 hours ago
     */
    async getLatest(ctx) {
      try {
        const apiKey = process.env.FIXER_API_KEY;
        const service = strapi.service("api::currency-rate.currency-rate");

        // Get rates, updating from API if necessary
        const rates = await service.getLatestRatesOrUpdate(apiKey);

        if (!rates) {
          return ctx.notFound("Currency rates not found");
        }

        return ctx.send({ data: rates });
      } catch (error) {
        console.error("Error getting latest currency rates:", error);
        return ctx.internalServerError("Failed to get currency rates");
      }
    },
  })
);
