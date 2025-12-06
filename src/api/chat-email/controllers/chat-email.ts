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
    try {
      strapi.log.info("📧 Received offline chat email request", {
        body: ctx.request.body,
      });

      const { recipientId, senderId, chatId, messageText, productId } =
        ctx.request.body || {};

      if (!recipientId || !senderId || !chatId || !messageText) {
        strapi.log.warn("❌ Missing required fields in offline chat email request", {
          recipientId,
          senderId,
          chatId,
          hasMessageText: !!messageText,
        });
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
          `❌ Recipient ${recipientId} not found or has no email`,
        );
        return ctx.badRequest("Recipient not found or has no email");
      }

      strapi.log.info(
        `📧 Processing offline chat email: recipient=${recipient.email}, sender=${senderId}, chatId=${chatId}`,
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
      strapi.log.info(
        `📧 Sending chat message notification email to ${recipient.email}`,
      );
      
      await sendChatMessageNotification(
        strapi,
        recipient.email,
        senderName,
        chatTopic,
        messageText,
        typeof chatId === 'string' ? parseInt(chatId, 10) : chatId
      );

      strapi.log.info(
        `✅ Offline chat email notification sent successfully to ${recipient.email}`,
      );

      return ctx.send({ success: true });
    } catch (error) {
      strapi.log.error("Failed to send offline chat email:", error);
      return ctx.internalServerError("Failed to send offline chat email");
    }
  },
};


