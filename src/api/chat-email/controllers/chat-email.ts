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
      const { recipientId, senderId, chatId, messageText, productId } =
        ctx.request.body || {};

      if (!recipientId || !senderId || !chatId || !messageText) {
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
        return ctx.badRequest("Recipient not found or has no email");
      }

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
        chatId
      );

      return ctx.send({ success: true });
    } catch (error) {
      strapi.log.error("Failed to send offline chat email:", error);
      return ctx.internalServerError("Failed to send offline chat email");
    }
  },
};


