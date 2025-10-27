/**
 * Turnstile validation utility
 */

interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  error_codes?: string[];
}

interface ValidateTurnstileOptions {
  token: string;
  secretKey: string;
  remoteip?: string;
}

/**
 * Validates a Turnstile token with Cloudflare's API
 */
export async function validateTurnstileToken({
  token,
  secretKey,
  remoteip,
}: ValidateTurnstileOptions): Promise<{
  success: boolean;
  error?: string;
  details?: TurnstileResponse;
}> {
  try {
    if (!token) {
      return {
        success: false,
        error: "Turnstile token is required",
      };
    }

    if (!secretKey) {
      return {
        success: false,
        error: "Turnstile secret key is not configured",
      };
    }

    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteip) {
      formData.append("remoteip", remoteip);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Turnstile API error: ${response.status} ${response.statusText}`,
      };
    }

    const result = (await response.json()) as TurnstileResponse;

    if (!result.success) {
      const errorMessages = result.error_codes?.map((code) => {
        switch (code) {
          case "missing-input-secret":
            return "The secret parameter is missing";
          case "invalid-input-secret":
            return "The secret parameter is invalid or malformed";
          case "missing-input-response":
            return "The response parameter is missing";
          case "invalid-input-response":
            return "The response parameter is invalid or malformed";
          case "bad-request":
            return "The request is invalid or malformed";
          case "timeout-or-duplicate":
            return "The response is no longer valid: either is too old or has been used previously";
          case "internal-error":
            return "An internal error happened while validating the response";
          default:
            return `Unknown error code: ${code}`;
        }
      }) || ["Unknown validation error"];

      return {
        success: false,
        error: errorMessages.join(", "),
        details: result,
      };
    }

    return {
      success: true,
      details: result,
    };
  } catch (error) {
    console.error("Turnstile validation error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 * Middleware function for Strapi to validate Turnstile tokens
 */
export function createTurnstileMiddleware(secretKey: string) {
  return async (ctx: any, next: () => Promise<void>) => {
    const turnstileToken = ctx.request.body?.turnstileToken;

    if (!turnstileToken) {
      return ctx.badRequest("Turnstile token is required");
    }

    const clientIP = ctx.request.ip || ctx.request.connection?.remoteAddress;

    const validation = await validateTurnstileToken({
      token: turnstileToken,
      secretKey,
      remoteip: clientIP,
    });

    if (!validation.success) {
      console.error("Turnstile validation failed:", validation.error);
      return ctx.badRequest(
        `Security verification failed: ${validation.error}`
      );
    }

    // Добавляем информацию о валидации в контекст
    ctx.state.turnstileValidation = validation.details;

    await next();
  };
}
