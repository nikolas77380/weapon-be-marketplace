/**
 * Utility for fetching currency rates from fixer.io API
 */

import fetch from "node-fetch";

interface FixerIOResponse {
  success: boolean;
  rates?: {
    [key: string]: number;
  };
  error?: {
    code: number;
    type: string;
    info: string;
  };
}

/**
 * Fetch currency rates from fixer.io
 * Returns rates with USD as base (1 USD = X EUR, 1 USD = X UAH)
 */
export async function fetchCurrencyRates(
  apiKey: string
): Promise<{ USD: number; EUR: number; UAH: number }> {
  if (!apiKey) {
    throw new Error("FIXER_API_KEY is not set");
  }

  try {
    // Fixer.io free plan uses EUR as base currency (cannot change base)
    // We'll get rates relative to EUR and convert to USD base
    const response = await fetch(
      `https://data.fixer.io/api/latest?access_key=${apiKey}&symbols=USD,UAH`
    );

    if (!response.ok) {
      throw new Error(
        `Fixer.io API error: ${response.status} ${response.statusText}`
      );
    }

    const data: FixerIOResponse = await response.json();

    if (!data.success) {
      throw new Error(
        `Fixer.io API error: ${data.error?.code} - ${data.error?.info || "Unknown error"}`
      );
    }

    if (!data.rates) {
      throw new Error("No rates returned from Fixer.io API");
    }

    // Convert from EUR base to USD base
    // If 1 EUR = X USD, then 1 USD = 1/X EUR
    // If 1 EUR = Y UAH, then 1 USD = Y/X UAH
    const usdToEur = 1 / data.rates.USD; // 1 USD in EUR
    const uahToEur = data.rates.UAH;
    const usdToUah = uahToEur / data.rates.USD; // 1 USD in UAH

    return {
      USD: 1.0,
      EUR: usdToEur,
      UAH: usdToUah,
    };
  } catch (error) {
    console.error("Error fetching currency rates from fixer.io:", error);
    throw error;
  }
}
