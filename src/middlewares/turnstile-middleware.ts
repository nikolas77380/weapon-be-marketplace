/**
 * Turnstile validation middleware for Strapi
 * Can be used to protect any route with Turnstile validation
 */

import { validateTurnstileToken } from "../utils/turnstile";

interface TurnstileMiddlewareOptions {
  required?: boolean; // Whether Turnstile validation is required (default: true)
  skipIfNoSecret?: boolean; // Skip validation if secret key is not configured (default: true)
}

/**
 * Creates a Turnstile validation middleware
 */
export function createTurnstileMiddleware(
  options: TurnstileMiddlewareOptions = {}
) {
  const { required = true, skipIfNoSecret = true } = options;

  return async (ctx: any, next: () => Promise<void>) => {
    try {
      const turnstileToken = ctx.request.body?.turnstileToken;
      const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;

      // If Turnstile is not configured and we should skip
      if (!turnstileSecretKey && skipIfNoSecret) {
        console.log(
          "⚠️ Turnstile secret key not configured, skipping validation"
        );
        await next();
        return;
      }

      // If Turnstile is required but token is missing
      if (required && !turnstileToken) {
        console.error("❌ Turnstile token is required but missing");
        return ctx.badRequest("Security verification token is required");
      }

      // If Turnstile is configured, validate the token
      if (turnstileSecretKey && turnstileToken) {
        const clientIP =
          ctx.request.ip || (ctx.request as any).connection?.remoteAddress;

        const validation = await validateTurnstileToken({
          token: turnstileToken,
          secretKey: turnstileSecretKey,
          remoteip: clientIP,
        });

        if (!validation.success) {
          console.error("❌ Turnstile validation failed:", validation.error);
          return ctx.badRequest(
            `Security verification failed: ${validation.error}`
          );
        }

        console.log("✅ Turnstile validation passed");

        // Add validation info to context for potential use
        ctx.state.turnstileValidation = validation.details;
      }

      await next();
    } catch (error) {
      console.error("Turnstile middleware error:", error);
      return ctx.internalServerError("Security verification service error");
    }
  };
}

/**
 * Pre-configured middleware for required Turnstile validation
 */
export const requireTurnstile = createTurnstileMiddleware({ required: true });

/**
 * Pre-configured middleware for optional Turnstile validation
 */
export const optionalTurnstile = createTurnstileMiddleware({ required: false });

/**
 * Pre-configured middleware that skips validation if not configured
 */
export const smartTurnstile = createTurnstileMiddleware({
  required: true,
  skipIfNoSecret: true,
});
