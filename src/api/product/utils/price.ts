/**
 * Helper function to auto-calculate prices in all currencies from any currency
 * @param strapi - Strapi instance
 * @param price - Price value in the specified currency
 * @param currency - Currency code (USD, EUR, or UAH)
 * @param data - Product data object to update
 */
export async function calculatePricesFromCurrency(
  strapi: any,
  price: number | string | undefined | null,
  currency: string | undefined | null,
  data: any
): Promise<void> {
  if (
    price === undefined ||
    price === null ||
    currency === undefined ||
    currency === null
  ) {
    return;
  }

  const validCurrencies = ["USD", "EUR", "UAH"];
  const upperCurrency = String(currency).toUpperCase();

  if (!validCurrencies.includes(upperCurrency)) {
    console.warn(`Invalid currency: ${currency}. Skipping price calculation.`);
    return;
  }

  try {
    const apiKey = process.env.FIXER_API_KEY;
    const currencyRateService = strapi.service(
      "api::currency-rate.currency-rate"
    );

    // Get latest rates (with auto-update if needed)
    const rates = await currencyRateService.getLatestRatesOrUpdate(apiKey);

    if (rates) {
      const priceValue = parseFloat(String(price));
      if (!isNaN(priceValue) && priceValue > 0) {
        // Rates are stored with USD as base (1 USD = X EUR, 1 USD = X UAH)
        const usdRate = parseFloat(rates.USD) || 1.0;
        const eurRate = parseFloat(rates.EUR) || 0;
        const uahRate = parseFloat(rates.UAH) || 0;

        let priceUSD: number;
        let priceEUR: number;
        let priceUAH: number;

        // Convert from input currency to USD first
        if (upperCurrency === "USD") {
          priceUSD = priceValue;
        } else if (upperCurrency === "EUR") {
          // Convert EUR to USD: if 1 USD = X EUR, then 1 EUR = 1/X USD
          priceUSD = priceValue / eurRate;
        } else if (upperCurrency === "UAH") {
          // Convert UAH to USD: if 1 USD = X UAH, then 1 UAH = 1/X USD
          priceUSD = priceValue / uahRate;
        } else {
          priceUSD = priceValue;
        }

        // Calculate other currencies from USD
        priceEUR = priceUSD * eurRate;
        priceUAH = priceUSD * uahRate;

        // Update data object
        data.priceUSD = parseFloat(priceUSD.toFixed(2));
        data.priceEUR = parseFloat(priceEUR.toFixed(2));
        data.priceUAH = parseFloat(priceUAH.toFixed(2));

        console.log(
          `Auto-calculated prices from ${upperCurrency}: ${upperCurrency}=${priceValue}, USD=${data.priceUSD}, EUR=${data.priceEUR}, UAH=${data.priceUAH}`
        );
      }
    } else {
      console.warn("Currency rates not available, skipping auto-calculation");
    }
  } catch (error) {
    console.error(
      `Error calculating prices from ${currency}:`,
      error,
      "Continuing without price calculation"
    );
    // Continue without price calculation if it fails
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use calculatePricesFromCurrency instead
 */
export async function calculatePricesFromUSD(
  strapi: any,
  priceUSD: number | string | undefined | null,
  data: any
): Promise<void> {
  await calculatePricesFromCurrency(strapi, priceUSD, "USD", data);
}
