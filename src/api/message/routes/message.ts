export default {
  routes: [
    {
      method: "GET",
      path: "/messages",
      handler: "message.find",
      config: {
        auth: {
          scope: ["find"],
        },
      },
    },
    {
      method: "GET",
      path: "/messages/:id",
      handler: "message.findOne",
      config: {
        auth: {
          scope: ["findOne"],
        },
      },
    },
    {
      method: "POST",
      path: "/messages",
      handler: "message.create",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/messages/:id",
      handler: "message.update",
      config: {
        auth: {},
      },
    },
    {
      method: "DELETE",
      path: "/messages/:id",
      handler: "message.delete",
      config: {
        auth: {},
      },
    },
    {
      method: "POST",
      path: "/messages/send",
      handler: "message.sendMessage",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/messages/chat/:chatId",
      handler: "message.getChatMessages",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/messages/mark-read",
      handler: "message.markAsRead",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/messages/chat/:chatId/mark-read",
      handler: "message.markChatAsRead",
      config: {
        auth: {},
      },
    },
  ],
};
