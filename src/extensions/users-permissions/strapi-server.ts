export default (plugin) => {
  // Override the default register controller
  plugin.controllers.auth.register = async (ctx) => {
    console.log("Custom register controller called");
    console.log("Request body:", ctx.request.body);

    const { email, username, password, displayName, storeRole } =
      ctx.request.body;

    // Validate required fields
    if (!email || !username || !password || !displayName || !storeRole) {
      console.log("Missing fields:", {
        email,
        username,
        password,
        displayName,
        storeRole,
      });
      return ctx.badRequest(
        "Missing required fields: email, username, password, displayName, storeRole"
      );
    }

    try {
      // Create user with additional fields
      const user = await strapi.plugins["users-permissions"].services.user.add({
        email,
        username,
        password,
        displayName,
        storeRole,
        provider: "local",
        confirmed: true, // Auto-confirm users
        role: 1, // Default authenticated role
      });

      // Generate JWT token
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      return {
        jwt,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          storeRole: user.storeRole,
          confirmed: user.confirmed,
          blocked: user.blocked,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  };

  return plugin;
};
