/**
 * Chat email notification routes
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/chat-email/offline-message",
      handler: "chat-email.notifyOfflineMessage",
      config: {
        auth: false, // Consider protecting with a shared secret or IP restriction
        policies: [],
        middlewares: [],
      },
    },
  ],
};


