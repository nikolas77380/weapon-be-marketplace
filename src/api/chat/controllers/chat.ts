import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::chat.chat",
  ({ strapi }) => ({
    // Получение чатов пользователя
    async findUserChats(ctx) {
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }
      console.log("user", user);
      const chats = await strapi.entityService.findMany("api::chat.chat", {
        filters: {
          participants: {
            id: user.id,
          },
        },
        populate: {
          participants: true,
          messages: {
            populate: {
              sender: true,
            },
            sort: { createdAt: "desc" },
          },
        },
        sort: { updatedAt: "desc" },
      });

      return { data: chats };
    },

    // Получение конкретного чата с сообщениями
    async findOneWithMessages(ctx) {
      const { id } = ctx.params;
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      // Получаем сообщения напрямую из модели messages
      const messages = await strapi.entityService.findMany(
        "api::message.message",
        {
          filters: {
            chat: id,
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

    // Создание нового чата
    async create(ctx) {
      const { topic, participantIds } = ctx.request.body;
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      if (!topic || !participantIds || !Array.isArray(participantIds)) {
        return ctx.badRequest("Topic and participantIds are required");
      }

      // Добавляем текущего пользователя к участникам
      const allParticipants = [...participantIds, user.id];

      const chat = await strapi.entityService.create("api::chat.chat", {
        data: {
          topic,
          participants: { connect: allParticipants } as any,
          status: "active",
        },
        populate: {
          participants: true,
        },
      });

      return { data: chat };
    },

    // Завершение чата
    async finishChat(ctx) {
      const { id } = ctx.params;
      const { status } = ctx.request.body;
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      if (
        ![
          "successfully_completed",
          "unsuccessfully_completed",
          "closed",
        ].includes(status)
      ) {
        return ctx.badRequest(
          "Invalid status. Must be: successfully_completed, unsuccessfully_completed, or closed"
        );
      }

      const chat = await strapi.entityService.findOne("api::chat.chat", id, {
        populate: {
          participants: true,
        },
      });

      if (!chat) {
        return ctx.notFound("Chat not found");
      }

      // Проверяем, является ли пользователь участником чата
      const isParticipant = (chat as any).participants?.some(
        (p: any) => p.id === user.id
      );
      if (!isParticipant) {
        return ctx.forbidden("You are not a participant of this chat");
      }

      const updatedChat = await strapi.entityService.update(
        "api::chat.chat",
        id,
        {
          data: {
            status,
          },
          populate: {
            participants: true,
          },
        }
      );

      return { data: updatedChat };
    },
    async getUnreadChatsCount(ctx) {
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      // Получаем все чаты пользователя
      const userChats = await strapi.entityService.findMany("api::chat.chat", {
        filters: {
          participants: {
            id: user.id,
          },
        },
        populate: {
          participants: true,
        },
      });

      const userChatIds = userChats.map((chat) => chat.id);

      if (userChatIds.length === 0) {
        return { data: { unreadCount: 0 } };
      }

      // Получаем все сообщения в чатах пользователя, где отправитель не пользователь и isRead = false
      const unreadMessages = await strapi.entityService.findMany(
        "api::message.message",
        {
          filters: {
            chat: {
              id: {
                $in: userChatIds,
              },
            },
            sender: {
              id: {
                $ne: user.id,
              },
            },
            isRead: false,
          },
          populate: {
            chat: true,
          },
        }
      );

      // Получаем уникальные ID чатов с непрочитанными сообщениями
      const unreadChatIds = [
        ...new Set(unreadMessages.map((msg) => (msg as any).chat.id)),
      ];

      return { data: { unreadCount: unreadChatIds.length } };
    },
  })
);
