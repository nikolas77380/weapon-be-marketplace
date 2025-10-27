/**
 * Support form controller - Simple version
 */

import { factories } from "@strapi/strapi";
import { validateTurnstileToken } from "../../../utils/turnstile";

export default factories.createCoreController(
  "api::support-form.support-form",
  ({ strapi }) => ({
    async sendSupportEmail(ctx) {
      try {
        console.log("📧 Support email request received:", ctx.request.body);

        const { name, email, message, turnstileToken } = ctx.request.body;

        // Валидация данных
        if (!name || !email || !message) {
          return ctx.send({ success: false, error: "Missing required fields" });
        }

        // Простая валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return ctx.send({ success: false, error: "Invalid email format" });
        }

        // Валидация Turnstile токена
        const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;
        if (!turnstileSecretKey) {
          console.warn("⚠️ Turnstile secret key not configured");
        } else {
          const clientIP = ctx.request.ip;
          const turnstileValidation = await validateTurnstileToken({
            token: turnstileToken,
            secretKey: turnstileSecretKey,
            remoteip: clientIP,
          });

          if (!turnstileValidation.success) {
            console.error(
              "❌ Turnstile validation failed:",
              turnstileValidation.error
            );
            return ctx.send({
              success: false,
              error: "Security verification failed. Please try again.",
            });
          }

          console.log("✅ Turnstile validation passed");
        }

        console.log("✅ Validation passed");

        // Сохраняем сообщение в базу данных
        try {
          const savedMessage = await strapi.entityService.create(
            "api::support-form.support-form",
            {
              data: {
                name,
                email,
                message,
                status: "new",
              },
            }
          );

          console.log("💾 Сообщение сохранено в базу данных:", savedMessage.id);
        } catch (dbError) {
          console.error("❌ Ошибка сохранения в базу данных:", dbError);
          // Продолжаем выполнение даже если не удалось сохранить в БД
        }

        // Простой ответ
        return ctx.send({ success: true });
      } catch (error) {
        console.error("❌ Error in support email controller:", error);
        return ctx.send({ success: false });
      }
    },

    // Метод для получения всех сообщений поддержки (для админки)
    async findAdmin(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        // Проверяем, что пользователь - администратор
        if (user.role?.name !== "Administrator") {
          return ctx.forbidden(
            "Only administrators can access support messages"
          );
        }

        const { query } = ctx;
        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 25;

        const filters = { ...(query.filters as any) };

        const totalCount = await strapi.entityService.count(
          "api::support-form.support-form",
          { filters }
        );

        const supportForms = await strapi.entityService.findMany(
          "api::support-form.support-form",
          {
            filters,
            sort: query.sort || ["createdAt:desc"],
            start: (page - 1) * pageSize,
            limit: pageSize,
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);

        return ctx.send({
          data: supportForms,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount,
              total: totalCount,
            },
          },
        });
      } catch (error) {
        console.error("Error fetching support forms:", error);
        return ctx.internalServerError("Failed to fetch support forms");
      }
    },

    // Метод для обновления статуса сообщения (для админки)
    async updateStatus(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        if (user.role?.name !== "Administrator") {
          return ctx.forbidden(
            "Only administrators can update support messages"
          );
        }

        const { id } = ctx.params;
        const { status, adminNotes } = ctx.request.body;

        const updateData: any = {};

        if (status) {
          updateData.status = status;
          if (status === "resolved") {
            updateData.resolvedAt = new Date();
          }
        }

        if (adminNotes !== undefined) {
          updateData.adminNotes = adminNotes;
        }

        const result = await strapi.entityService.update(
          "api::support-form.support-form",
          id,
          { data: updateData }
        );

        return ctx.send(result);
      } catch (error) {
        console.error("Error updating support form:", error);
        return ctx.internalServerError("Failed to update support form");
      }
    },
  })
);
