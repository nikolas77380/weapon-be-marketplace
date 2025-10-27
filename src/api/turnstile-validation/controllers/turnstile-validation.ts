/**
 * API endpoint для валидации Turnstile токенов
 * Используется для дополнительной проверки на бэкенде
 */

import { validateTurnstileToken } from "../../../utils/turnstile";

export default {
  async validateTurnstile(ctx: any) {
    try {
      const { token, clientIP } = ctx.request.body;

      if (!token) {
        return ctx.badRequest("Turnstile token is required");
      }

      const secretKey = process.env.TURNSTILE_SECRET_KEY;

      // Если Turnstile не настроен, возвращаем успех
      if (!secretKey) {
        console.warn(
          "Turnstile secret key not configured, skipping validation"
        );
        return ctx.send({ isValid: true });
      }

      const validation = await validateTurnstileToken({
        token,
        secretKey,
        remoteip: clientIP || ctx.request.ip,
      });

      return ctx.send({
        isValid: validation.success,
        error: validation.error,
        details: validation.details,
      });
    } catch (error) {
      console.error("Turnstile validation API error:", error);
      return ctx.internalServerError("Validation service error");
    }
  },
};
