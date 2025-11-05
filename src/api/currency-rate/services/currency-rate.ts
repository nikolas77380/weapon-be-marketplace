/**
 * currency-rate service
 */

import { factories } from "@strapi/strapi";

// In-memory cache for currency rates (1 hour TTL)
let cachedRates: {
  rates: any;
  timestamp: number;
} | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

export default factories.createCoreService(
  "api::currency-rate.currency-rate" as any,
  ({ strapi }) => {
    const getLatestRates = async () => {
      try {
        const rates = await strapi.entityService.findMany(
          "api::currency-rate.currency-rate" as any,
          {
            sort: { date: "desc" },
            limit: 1,
          }
        );

        if (!rates || rates.length === 0) {
          return null;
        }

        return rates[0];
      } catch (error) {
        console.error("Error fetching latest currency rates:", error);
        throw error;
      }
    };

    const upsertRates = async (rates: {
      USD: number;
      EUR: number;
      UAH: number;
    }) => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        // Check if rates for today already exist
        const existing = await strapi.entityService.findMany(
          "api::currency-rate.currency-rate" as any,
          {
            filters: { date: todayStr },
            limit: 1,
          }
        );

        if (existing && existing.length > 0) {
          // Update existing rates
          return await strapi.entityService.update(
            "api::currency-rate.currency-rate" as any,
            existing[0].id,
            {
              data: rates,
            }
          );
        } else {
          // Create new rates
          return await strapi.entityService.create(
            "api::currency-rate.currency-rate" as any,
            {
              data: {
                ...rates,
                date: todayStr,
              },
            }
          );
        }
      } catch (error) {
        console.error("Error upserting currency rates:", error);
        throw error;
      }
    };

    const needsUpdate = async (): Promise<boolean> => {
      try {
        const latest = await getLatestRates();

        if (!latest) {
          return true; // No rates exist, need to fetch
        }

        // Check updatedAt timestamp
        const lastUpdate = new Date(latest.updatedAt || latest.createdAt);
        const now = new Date();
        const hoursSinceUpdate =
          (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

        return hoursSinceUpdate >= 24;
      } catch (error) {
        console.error("Error checking if rates need update:", error);
        return true; // On error, try to update
      }
    };

    const getLatestRatesOrUpdate = async (apiKey?: string) => {
      // Check memory cache first (fast path)
      const now = Date.now();
      if (cachedRates && now - cachedRates.timestamp < CACHE_TTL) {
        return cachedRates.rates;
      }

      // Check if update is needed (slower, but cached check)
      const shouldUpdate = await needsUpdate();

      if (shouldUpdate && apiKey) {
        try {
          const { fetchCurrencyRates } = await import(
            "../../../utils/fixer-io"
          );
          const rates = await fetchCurrencyRates(apiKey);
          await upsertRates(rates);

          // Update memory cache
          const latestRates = await getLatestRates();
          if (latestRates) {
            cachedRates = {
              rates: latestRates,
              timestamp: now,
            };
            return latestRates;
          }
        } catch (error) {
          console.error("Failed to update currency rates from API:", error);
          // Continue to return existing rates even if update failed
        }
      }

      // Get latest rates from DB and cache them
      const latestRates = await getLatestRates();
      if (latestRates) {
        cachedRates = {
          rates: latestRates,
          timestamp: now,
        };
      }
      return latestRates;
    };

    return {
      /**
       * Get the latest currency rates
       */
      getLatestRates,

      /**
       * Check if rates need to be updated (last update was more than 24 hours ago)
       */
      needsUpdate,

      /**
       * Get latest rates, updating from API if necessary
       */
      getLatestRatesOrUpdate,

      /**
       * Create or update currency rates for today
       */
      upsertRates,
    };
  }
);
