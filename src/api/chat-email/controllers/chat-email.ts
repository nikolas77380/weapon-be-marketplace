/**
 * Chat email notification controller.
 * Used by the message-service to trigger email when a user receives
 * a new chat message while being offline.
 */

import { sendChatMessageNotification } from "../../../utils/email-notifications";

export default {
  /**
   * POST /chat-email/offline-message
   *
   * Expected body:
   * {
   *   recipientId: number;
   *   senderId: number;
   *   chatId: string;
   *   messageText: string;
   *   productId?: number;
   * }
   */
  async notifyOfflineMessage(ctx: any) {
    const body = ctx.request.body || {};
    strapi.log.info(
      `[CHAT-EMAIL] Received request: recipientId=${body.recipientId}, senderId=${body.senderId}, chatId=${body.chatId}`
    );
    console.log(
      `[CHAT-EMAIL] 📧 Received request: recipientId=${body.recipientId}, senderId=${body.senderId}, chatId=${body.chatId}`
    );

    try {
      const { recipientId, senderId, chatId, messageText, productId } =
        ctx.request.body || {};

      if (!recipientId || !senderId || !chatId || !messageText) {
        strapi.log.warn(
          `[CHAT-EMAIL] Missing required fields: recipientId=${!!recipientId}, senderId=${!!senderId}, chatId=${!!chatId}, messageText=${!!messageText}`
        );
        return ctx.badRequest("Missing required fields");
      }

      // Load recipient user
      const recipient = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        recipientId,
        {
          fields: ["id", "email", "username"],
        }
      );

      if (!recipient || !recipient.email) {
        strapi.log.warn(
          `[CHAT-EMAIL] Recipient ${recipientId} not found or has no email`
        );
        return ctx.badRequest("Recipient not found or has no email");
      }

      strapi.log.info(
        `[CHAT-EMAIL] Sending email to ${recipient.email} for chat ${chatId}`
      );
      console.log(
        `[CHAT-EMAIL] 📧 Sending email to ${recipient.email} for chat ${chatId}`
      );

      // Load sender user (for sender name)
      const sender = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        senderId,
        {
          fields: ["id", "username"],
        }
      );

      const senderName = sender?.username || "Користувач";

      // Determine chat topic (e.g. product title) if productId is provided
      let chatTopic = "Чат на маркетплейсі";

      if (productId) {
        try {
          const product = await strapi.entityService.findOne(
            "api::product.product",
            productId,
            {
              fields: ["title"],
            }
          );

          if (product) {
            chatTopic = (product as any).title || chatTopic;
          }
        } catch (productError) {
          strapi.log.warn(
            `Failed to load product ${productId} for chat email:`,
            productError
          );
        }
      }

      // Fire-and-forget email sending; errors are handled inside helper
      await sendChatMessageNotification(
        strapi,
        recipient.email,
        senderName,
        chatTopic,
        messageText,
        typeof chatId === "string" ? parseInt(chatId, 10) : chatId
      );

      strapi.log.info(
        `[CHAT-EMAIL] Email notification sent successfully to ${recipient.email}`
      );
      console.log(
        `[CHAT-EMAIL] ✅ Email notification sent successfully to ${recipient.email}`
      );

      return ctx.send({ success: true });
    } catch (error) {
      strapi.log.error(
        "[CHAT-EMAIL] ❌ Failed to send offline chat email:",
        error
      );
      console.error(
        "[CHAT-EMAIL] ❌ Failed to send offline chat email:",
        error
      );
      return ctx.internalServerError("Failed to send offline chat email");
    }
  },
};
