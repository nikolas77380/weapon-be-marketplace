/**
 * Product content translation (UA <-> EN) via OpenAI API.
 * Uses node-fetch to avoid extra dependency; set OPENAI_API_KEY in env.
 */

import fetch from "node-fetch";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export type ContentLanguage = "ua" | "en";

/**
 * Translate text to Ukrainian. Returns null on failure (log and continue without translation).
 */
export async function translateToUkrainian(text: string): Promise<string | null> {
  if (!text || !text.trim()) return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[translate] OPENAI_API_KEY not set, skipping translation to Ukrainian");
    return null;
  }
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator. Translate the given text from English to Ukrainian. Preserve meaning and tone. Return only the translation, no explanations. If the text contains HTML or markup, preserve structure and translate only text content.",
          },
          { role: "user", content: text },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.error("[translate] OpenAI API error:", response.status, errBody);
      return null;
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translated =
      data?.choices?.[0]?.message?.content?.trim();
    return translated || null;
  } catch (error) {
    console.error("[translate] Error translating to Ukrainian:", error);
    return null;
  }
}

/**
 * Translate text to English. Returns null on failure.
 */
export async function translateToEnglish(text: string): Promise<string | null> {
  if (!text || !text.trim()) return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[translate] OPENAI_API_KEY not set, skipping translation to English");
    return null;
  }
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator. Translate the given text from Ukrainian to English. Preserve meaning and tone. Return only the translation, no explanations. If the text contains HTML or markup, preserve structure and translate only text content.",
          },
          { role: "user", content: text },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.error("[translate] OpenAI API error:", response.status, errBody);
      return null;
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translated =
      data?.choices?.[0]?.message?.content?.trim();
    return translated || null;
  } catch (error) {
    console.error("[translate] Error translating to English:", error);
    return null;
  }
}

/**
 * Translate product title and description to the target language.
 * Returns { title, description } or null values for failed parts.
 */
export async function translateProductContent(
  title: string,
  description: string | undefined | null,
  targetLanguage: "ua" | "en"
): Promise<{ title: string | null; description: string | null }> {
  const translateTitle = targetLanguage === "ua" ? translateToUkrainian : translateToEnglish;
  const translateDesc = targetLanguage === "ua" ? translateToUkrainian : translateToEnglish;

  const [titleTranslated, descriptionTranslated] = await Promise.all([
    translateTitle(title),
    description ? translateDesc(description) : Promise.resolve(null),
  ]);

  return {
    title: titleTranslated ?? null,
    description: descriptionTranslated ?? null,
  };
}
