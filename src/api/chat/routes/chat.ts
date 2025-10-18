export default {
  routes: [
    {
      method: "GET",
      path: "/chats/user",
      handler: "chat.findUserChats",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/chats/:id/messages",
      handler: "chat.findOneWithMessages",
      config: {
        auth: {},
      },
    },
    {
      method: "POST",
      path: "/chats",
      handler: "chat.create",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/chats/:id/finish",
      handler: "chat.finishChat",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/chats/unread-count",
      handler: "chat.getUnreadChatsCount",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/chats/stats",
      handler: "chat-stats.getChatStats",
      config: {
        auth: {},
      },
    },
  ],
};
