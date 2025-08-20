export default (plugin) => {
  // Override the register controller
  plugin.controllers.auth.register = async (ctx) => {
    console.log("Custom auth controller: Processing registration");
    console.log("Request body:", ctx.request.body);

    const { email, username, password, displayName, storeRole } =
      ctx.request.body;

    // Validate required fields
    if (!email || !username || !password || !displayName || !storeRole) {
      console.log("Custom auth controller: Missing required fields");
      return ctx.badRequest(
        "Missing required fields: email, username, password, displayName, storeRole"
      );
    }

    try {
      // Create user with additional fields
      const userData = {
        email,
        username,
        password,
        displayName,
        storeRole,
        confirmed: true,
        provider: "local",
        role: 1,
      };

      console.log("Custom auth controller: Creating user with data:", userData);

      const user =
        await strapi.plugins["users-permissions"].services.user.add(userData);

      console.log("Custom auth controller: User created:", user);

      // Fetch the user again to get all fields including storeRole
      const fullUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        user.id,
        {
          populate: "*",
        }
      );

      console.log("Custom auth controller: Full user data:", fullUser);

      // Generate JWT token
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      // Return response
      const response = {
        jwt,
        user: {
          id: fullUser.id,
          username: fullUser.username,
          email: fullUser.email,
          displayName: fullUser.displayName,
          storeRole: fullUser.storeRole,
          confirmed: fullUser.confirmed,
          blocked: fullUser.blocked,
          createdAt: fullUser.createdAt,
          updatedAt: fullUser.updatedAt,
        },
      };

      console.log("Custom auth controller: Returning response:", response);
      ctx.body = response;
    } catch (error) {
      console.log("Custom auth controller: Error:", error.message);
      return ctx.badRequest(error.message);
    }
  };

  return plugin;
};
