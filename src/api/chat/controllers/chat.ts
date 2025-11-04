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
          participants: {
            populate: {
              metadata: {
                populate: {
                  avatar: true,
                },
              },
            },
          },
          product: {
            populate: {
              images: true,
            },
          },
          messages: {
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
              product: {
                populate: {
                  images: true,
                },
              },
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
            sender: {
              populate: {
                metadata: {
                  populate: {
                    avatar: true,
                  },
                },
              },
            },
            readBy: {
              populate: {
                metadata: {
                  populate: {
                    avatar: true,
                  },
                },
              },
            },
            product: {
              populate: {
                images: true,
              },
            },
          },
          sort: { createdAt: "asc" },
        }
      );

      return { data: messages };
    },

    // Создание нового чата или возврат существующего
    async create(ctx) {
      const { topic, participantIds, productId } = ctx.request.body;
      const { user } = ctx.state;

      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      if (!participantIds || !Array.isArray(participantIds)) {
        return ctx.badRequest("participantIds are required");
      }

      // Добавляем текущего пользователя к участникам
      const allParticipants = [...participantIds, user.id];

      // Убеждаемся, что участников ровно двое (продавец и покупатель)
      if (allParticipants.length !== 2) {
        return ctx.badRequest(
          "Chat must have exactly 2 participants (seller and buyer)"
        );
      }

      try {
        // Если указан productId, проверяем, что товар существует и получаем продавца
        let sellerId: number | null = null;
        if (productId) {
          const product = await strapi.entityService.findOne(
            "api::product.product",
            productId,
            {
              populate: {
                seller: true,
              },
            }
          );

          if (!product) {
            return ctx.notFound("Product not found");
          }

          sellerId = (product as any).seller?.id;
          if (!sellerId) {
            return ctx.badRequest("Product has no seller");
          }

          // Проверяем, что продавец товара является одним из участников
          if (!allParticipants.includes(sellerId)) {
            return ctx.badRequest(
              "Seller of the product must be one of the participants"
            );
          }
        }

        // Ищем существующий активный чат между этими двумя участниками
        const existingChats = await strapi.entityService.findMany(
          "api::chat.chat",
          {
            filters: {
              participants: {
                id: {
                  $in: allParticipants,
                },
              },
              status: "active",
            },
            populate: {
              participants: {
                populate: {
                  metadata: true,
                },
              },
              product: true,
            },
          }
        );

        // Фильтруем чаты, которые содержат ровно этих двух участников
        const validChats = existingChats.filter((chat) => {
          const chatParticipantIds = (chat as any).participants.map(
            (p: any) => p.id
          );
          return (
            allParticipants.every((id) => chatParticipantIds.includes(id)) &&
            chatParticipantIds.length === allParticipants.length
          );
        });

        // Если указан productId, ищем чат с этим продуктом
        if (productId && validChats.length > 0) {
          const chatWithProduct = validChats.find(
            (chat) => (chat as any).product?.id === productId
          );

          // Если найден чат с тем же товаром, проверяем, есть ли пользовательские сообщения
          if (chatWithProduct) {
            // Проверяем, есть ли пользовательские (не системные) сообщения в чате
            const userMessages = await strapi.entityService.findMany(
              "api::message.message",
              {
                filters: {
                  chat: chatWithProduct.id,
                  isSystem: false,
                } as any,
                limit: 1,
              }
            );

            // Если нет пользовательских сообщений, проверяем системное сообщение с товаром
            if (userMessages.length === 0) {
              // Ищем все системные сообщения с товаром
              const systemMessagesWithProduct =
                await strapi.entityService.findMany("api::message.message", {
                  filters: {
                    chat: chatWithProduct.id,
                    isSystem: true,
                    product: {
                      id: productId,
                    },
                  } as any,
                });

              // Если есть старое системное сообщение, удаляем его
              if (systemMessagesWithProduct.length > 0) {
                for (const oldMessage of systemMessagesWithProduct) {
                  await strapi.entityService.delete(
                    "api::message.message",
                    oldMessage.id
                  );
                }
              }

              // Создаем новое системное сообщение с текущим товаром
              const product = await strapi.entityService.findOne(
                "api::product.product",
                productId,
                {
                  populate: {
                    images: true,
                  },
                }
              );

              if (product) {
                const systemMessageText = `${(product as any).title}`;
                await strapi.entityService.create("api::message.message", {
                  data: {
                    text: systemMessageText,
                    chat: { connect: [chatWithProduct.id] } as any,
                    isSystem: true as any,
                    product: { connect: [productId] } as any,
                    isRead: true,
                  } as any,
                  populate: {
                    product: {
                      populate: {
                        images: true,
                      },
                    },
                  } as any,
                });
              }
            }

            return { data: chatWithProduct };
          }

          // Если есть чат, но с другим товаром - обновляем товар и создаем системное сообщение
          const existingChat = validChats[0];
          const currentProductId = (existingChat as any).product?.id;

          if (currentProductId && currentProductId !== productId) {
            // Проверяем, есть ли пользовательские (не системные) сообщения в чате
            const userMessages = await strapi.entityService.findMany(
              "api::message.message",
              {
                filters: {
                  chat: existingChat.id,
                  isSystem: false,
                } as any,
                limit: 1,
              }
            );

            // Если нет пользовательских сообщений, удаляем старое системное сообщение с товаром
            if (userMessages.length === 0) {
              const oldSystemMessages = await strapi.entityService.findMany(
                "api::message.message",
                {
                  filters: {
                    chat: existingChat.id,
                    isSystem: true,
                    product: {
                      id: currentProductId,
                    },
                  } as any,
                }
              );

              // Удаляем все старые системные сообщения с товаром
              for (const oldMessage of oldSystemMessages) {
                await strapi.entityService.delete(
                  "api::message.message",
                  oldMessage.id
                );
              }
            }

            // Обновляем товар в чате
            const updatedChat = await strapi.entityService.update(
              "api::chat.chat",
              existingChat.id,
              {
                data: {
                  product: { connect: [productId] } as any,
                },
                populate: {
                  participants: {
                    populate: {
                      metadata: true,
                    },
                  },
                  product: {
                    populate: {
                      images: true,
                    },
                  },
                } as any,
              }
            );

            // Проверяем последнее сообщение в чате
            const lastMessages = await strapi.entityService.findMany(
              "api::message.message",
              {
                filters: {
                  chat: existingChat.id,
                } as any,
                populate: {
                  product: true,
                },
                sort: { createdAt: "desc" },
                limit: 1,
              }
            );

            // Создаем системное сообщение о смене товара только если последнее сообщение не такое же
            const lastMessage = lastMessages[0];
            const shouldCreateSystemMessage =
              !lastMessage ||
              !(lastMessage as any).isSystem ||
              (lastMessage as any).product?.id !== productId;

            if (shouldCreateSystemMessage) {
              const product = await strapi.entityService.findOne(
                "api::product.product",
                productId,
                {
                  populate: {
                    images: true,
                  },
                }
              );

              if (product) {
                const systemMessageText = `${(product as any).title}`;
                await strapi.entityService.create("api::message.message", {
                  data: {
                    text: systemMessageText,
                    chat: { connect: [existingChat.id] } as any,
                    isSystem: true as any,
                    product: { connect: [productId] } as any,
                    isRead: true, // Системные сообщения считаются прочитанными
                  } as any,
                  populate: {
                    product: {
                      populate: {
                        images: true,
                      },
                    },
                  } as any,
                });
              }
            }

            return { data: updatedChat };
          }
        }

        // Если есть активный чат между этими участниками (без продукта или с другим продуктом), возвращаем его
        // Это обеспечивает один чат на пару продавец-покупатель
        if (validChats.length > 0) {
          const existingChat = validChats[0];

          // Если чат без товара, но указан новый товар - добавляем товар и создаем системное сообщение
          if (productId && !(existingChat as any).product) {
            // Проверяем, есть ли пользовательские (не системные) сообщения в чате
            const userMessages = await strapi.entityService.findMany(
              "api::message.message",
              {
                filters: {
                  chat: existingChat.id,
                  isSystem: false,
                } as any,
                limit: 1,
              }
            );

            // Если нет пользовательских сообщений, удаляем все старые системные сообщения с товаром
            if (userMessages.length === 0) {
              const oldSystemMessages = await strapi.entityService.findMany(
                "api::message.message",
                {
                  filters: {
                    chat: existingChat.id,
                    isSystem: true,
                  } as any,
                  populate: {
                    product: true,
                  },
                }
              );

              // Удаляем все старые системные сообщения с товаром
              for (const oldMessage of oldSystemMessages) {
                if ((oldMessage as any).product) {
                  await strapi.entityService.delete(
                    "api::message.message",
                    oldMessage.id
                  );
                }
              }
            }

            // Обновляем товар в чате
            const updatedChat = await strapi.entityService.update(
              "api::chat.chat",
              existingChat.id,
              {
                data: {
                  product: { connect: [productId] } as any,
                },
                populate: {
                  participants: {
                    populate: {
                      metadata: true,
                    },
                  },
                  product: {
                    populate: {
                      images: true,
                    },
                  },
                } as any,
              }
            );

            // Проверяем последнее сообщение в чате
            const lastMessages = await strapi.entityService.findMany(
              "api::message.message",
              {
                filters: {
                  chat: existingChat.id,
                } as any,
                populate: {
                  product: true,
                },
                sort: { createdAt: "desc" },
                limit: 1,
              }
            );

            // Создаем системное сообщение о товаре только если последнее сообщение не такое же
            const lastMessage = lastMessages[0];
            const shouldCreateSystemMessage =
              !lastMessage ||
              !(lastMessage as any).isSystem ||
              (lastMessage as any).product?.id !== productId;

            if (shouldCreateSystemMessage) {
              const product = await strapi.entityService.findOne(
                "api::product.product",
                productId,
                {
                  populate: {
                    images: true,
                  },
                }
              );

              if (product) {
                const systemMessageText = `${(product as any).title}`;
                await strapi.entityService.create("api::message.message", {
                  data: {
                    text: systemMessageText,
                    chat: { connect: [existingChat.id] } as any,
                    isSystem: true as any,
                    product: { connect: [productId] } as any,
                    isRead: true,
                  } as any,
                  populate: {
                    product: {
                      populate: {
                        images: true,
                      },
                    },
                  } as any,
                });
              }
            }

            return { data: updatedChat };
          }

          return { data: existingChat };
        }

        // Генерируем topic автоматически, если не указан
        let chatTopic = topic;
        if (!chatTopic) {
          // Получаем данные участников для генерации topic
          const otherParticipantId = allParticipants.find(
            (id) => id !== user.id
          );
          if (otherParticipantId) {
            const otherParticipant = await strapi.entityService.findOne(
              "plugin::users-permissions.user",
              otherParticipantId,
              {
                populate: {
                  metadata: true,
                },
              }
            );
            if (otherParticipant) {
              const otherUser = otherParticipant as any;
              if (otherUser.metadata?.companyName) {
                chatTopic = `${otherUser.username} (${otherUser.metadata.companyName})`;
              } else {
                chatTopic = otherUser.displayName || otherUser.username;
              }
            }
          }
        }

        // Если чат не найден, создаем новый
        const chatData: any = {
          topic: chatTopic || "Chat",
          participants: { connect: allParticipants } as any,
          status: "active",
        };

        // Добавляем product, если указан
        if (productId) {
          chatData.product = { connect: [productId] } as any;
        }

        const chat = await strapi.entityService.create("api::chat.chat", {
          data: chatData,
          populate: {
            participants: {
              populate: {
                metadata: true,
              },
            },
            product: {
              populate: {
                images: true,
              },
            },
          },
        });

        // Если чат создан с товаром, создаем системное сообщение
        // Для нового чата проверка не нужна, так как сообщений еще нет
        if (productId) {
          const product = await strapi.entityService.findOne(
            "api::product.product",
            productId,
            {
              populate: {
                images: true,
              },
            }
          );

          if (product) {
            const systemMessageText = `${(product as any).title}`;
            await strapi.entityService.create("api::message.message", {
              data: {
                text: systemMessageText,
                chat: { connect: [chat.id] } as any,
                isSystem: true as any,
                product: { connect: [productId] } as any,
                isRead: true,
              } as any,
              populate: {
                product: {
                  populate: {
                    images: true,
                  },
                },
              } as any,
            });
          }
        }

        return { data: chat };
      } catch (error) {
        console.error("Error creating/finding chat:", error);
        return ctx.internalServerError("Failed to create/find chat");
      }
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
