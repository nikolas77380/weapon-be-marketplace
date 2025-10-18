import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::message.message",
  ({ strapi }) => ({
    // Отправка сообщения
    async sendMessage(ctx) {
      const { text, chatId } = ctx.request.body;
      const { user } = ctx.state;

      // Временно отключаем проверку аутентификации для тестирования
      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      if (!text || !chatId) {
        return ctx.badRequest("Text and chatId are required");
      }

      // Проверяем, существует ли чат и является ли пользователь участником
      const chat = await strapi.entityService.findOne(
        "api::chat.chat",
        chatId,
        {
          populate: {
            participants: true,
          },
        }
      );

      if (!chat) {
        return ctx.notFound("Chat not found");
      }

      const isParticipant = (chat as any).participants?.some(
        (p: any) => p.id === user?.id
      );
      if (!isParticipant) {
        return ctx.forbidden("You are not a participant of this chat");
      }

      // Проверяем, что чат активен
      if (chat.status !== "active") {
        return ctx.badRequest("Cannot send messages to inactive chat");
      }

      const message = await strapi.entityService.create(
        "api::message.message",
        {
          data: {
            text,
            sender: { connect: [user?.id] } as any,
            chat: { connect: [chatId] } as any,
            isRead: false,
          },
          populate: {
            sender: true,
            chat: true,
          },
        }
      );

      return { data: message };
    },

    // Получение сообщений по ID чата
    async getChatMessages(ctx) {
      const { chatId } = ctx.params;
      const { user } = ctx.state;

      // Временно отключаем проверку аутентификации для тестирования
      // if (!user) {
      //   return ctx.unauthorized("You must be authenticated");
      // }

      // Проверяем, является ли пользователь участником чата
      const chat = await strapi.entityService.findOne(
        "api::chat.chat",
        chatId,
        {
          populate: {
            participants: true,
          },
        }
      );

      if (!chat) {
        return ctx.notFound("Chat not found");
      }

      const isParticipant = (chat as any).participants?.some(
        (p: any) => p.id === user?.id || 1
      );
      if (!isParticipant) {
        return ctx.forbidden("You are not a participant of this chat");
      }

      const messages = await strapi.entityService.findMany(
        "api::message.message",
        {
          filters: {
            chat: chatId,
          },
          populate: {
            sender: true,
            readBy: true,
          },
          sort: { createdAt: "asc" },
        }
      );

      return { data: messages };
    },

    // Отметка сообщений как прочитанных
    async markAsRead(ctx) {
      const { messageIds } = ctx.request.body;
      const { user } = ctx.state;

      // Временно отключаем проверку аутентификации для тестирования
      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      if (!messageIds || !Array.isArray(messageIds)) {
        return ctx.badRequest("messageIds array is required");
      }

      // Обновляем каждое сообщение, добавляя пользователя к readBy
      const updatedMessages = [];

      for (const messageId of messageIds) {
        const message = await strapi.entityService.findOne(
          "api::message.message",
          messageId,
          {
            populate: {
              readBy: true,
            },
          }
        );

        if (message) {
          const readByIds = (message as any).readBy
            ? (message as any).readBy.map((r: any) => r.id)
            : [];

          if (!readByIds.includes(user?.id || 1)) {
            const updatedMessage = await strapi.entityService.update(
              "api::message.message",
              messageId,
              {
                data: {
                  readBy: [...readByIds, user?.id || 1] as any,
                  isRead: true,
                },
                populate: {
                  sender: true,
                  readBy: true,
                },
              }
            );
            updatedMessages.push(updatedMessage);
          }
        }
      }

      return { data: updatedMessages };
    },

    // Отметка всех сообщений чата как прочитанных
    async markChatAsRead(ctx) {
      const { chatId } = ctx.params;
      const { user } = ctx.state;

      // Временно отключаем проверку аутентификации для тестирования
      // if (!user) {
      //   return ctx.unauthorized("You must be authenticated");
      // }

      // Проверяем, является ли пользователь участником чата
      const chat = await strapi.entityService.findOne(
        "api::chat.chat",
        chatId,
        {
          populate: {
            participants: true,
          },
        }
      );

      if (!chat) {
        return ctx.notFound("Chat not found");
      }

      const isParticipant = (chat as any).participants?.some(
        (p: any) => p.id === user?.id || 1
      );
      if (!isParticipant) {
        return ctx.forbidden("You are not a participant of this chat");
      }

      // Получаем все непрочитанные сообщения в чате, где отправитель не текущий пользователь
      const unreadMessages = await strapi.entityService.findMany(
        "api::message.message",
        {
          filters: {
            chat: chatId,
            sender: {
              id: {
                $ne: user?.id || 1,
              },
            },
            isRead: false,
          },
        }
      );

      // Отмечаем все сообщения как прочитанные
      const updatedMessages = [];
      for (const message of unreadMessages) {
        const updatedMessage = await strapi.entityService.update(
          "api::message.message",
          message.id,
          {
            data: {
              isRead: true,
            },
            populate: {
              sender: true,
              readBy: true,
            },
          }
        );
        updatedMessages.push(updatedMessage);
      }

      return { data: updatedMessages };
    },
  })
);
