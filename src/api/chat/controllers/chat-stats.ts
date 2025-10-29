import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::chat.chat",
  ({ strapi }) => ({
    // Получение статистики чатов
    async getChatStats(ctx) {
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      try {
        console.log(`Getting chat stats for user ${user.id}`);

        // Получаем все чаты пользователя
        const userChats = await strapi.entityService.findMany(
          "api::chat.chat",
          {
            filters: {
              participants: {
                id: user.id,
              },
            },
            populate: {
              participants: true,
            },
          }
        );

        console.log(`Found ${userChats.length} chats for user`);

        // Подсчитываем активные чаты
        const activeChats = userChats.filter(
          (chat) => chat.status === "active"
        );
        const activeChatsCount = activeChats.length;
        console.log(`Active chats: ${activeChatsCount}`);

        // Подсчитываем закрытые чаты (завершенные)
        const closedChats = userChats.filter(
          (chat) =>
            chat.status === "successfully_completed" ||
            chat.status === "unsuccessfully_completed" ||
            chat.status === "closed"
        );
        const closedChatsCount = closedChats.length;
        console.log(`Closed chats: ${closedChatsCount}`);

        // Получаем последние 5 чатов пользователя, отсортированных по времени обновления
        const recentChats = userChats
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          .slice(0, 5);

        // Получаем по 1 последнему сообщению из каждого из последних 5 чатов
        let latestMessages = [];
        for (const chat of recentChats) {
          try {
            console.log(`Getting messages for chat ${chat.id}`);
            const lastMessage = await strapi.entityService.findMany(
              "api::message.message",
              {
                filters: {
                  chat: {
                    id: chat.id,
                  },
                },
                populate: {
                  sender: {
                    populate: {
                      metadata: {
                        populate: {
                          avatar: true,
                        },
                      },
                    },
                  },
                  chat: {
                    populate: {
                      participants: {
                        populate: {
                          metadata: {
                            populate: {
                              avatar: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
                sort: { createdAt: "desc" },
                limit: 1,
              }
            );

            console.log(
              `Found ${lastMessage.length} messages for chat ${chat.id}`
            );
            if (lastMessage.length > 0) {
              latestMessages.push(lastMessage[0]);
            }
          } catch (messageError) {
            console.error(
              `Error getting messages for chat ${chat.id}:`,
              messageError
            );
          }
        }

        return {
          data: {
            activeChatsCount,
            closedChatsCount,
            latestMessages,
          },
        };
      } catch (error) {
        console.error("Error getting chat stats:", error);
        return ctx.internalServerError("Failed to get chat statistics");
      }
    },
  })
);
