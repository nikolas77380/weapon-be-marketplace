export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Check if this is a registration request
    if (
      ctx.request.url === "/api/auth/local/register" &&
      ctx.request.method === "POST"
    ) {
      console.log("Auth middleware: Processing registration request");
      console.log("Request body:", ctx.request.body);

      const { email, username, password, displayName, storeRole } =
        ctx.request.body;

      // Validate required fields
      if (!email || !username || !password || !displayName || !storeRole) {
        console.log("Auth middleware: Missing required fields");
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
          confirmed: true, // Auto-confirm users
          role: 1, // Default authenticated role
        };

        console.log("Auth middleware: Creating user with data:", userData);

        // Try using entityService directly
        const user = await strapi.entityService.create(
          "plugin::users-permissions.user",
          {
            data: userData,
          }
        );

        console.log("Auth middleware: User created:", user);

        // Fetch the user again to get all fields
        const fullUser = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          user.id,
          {
            populate: "*",
          }
        );

        console.log("Auth middleware: Full user data:", fullUser);

        // Generate JWT token
        const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
          id: user.id,
        });

        // Return the response directly
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

        console.log("Auth middleware: Returning response:", response);
        ctx.body = response;

        console.log("Auth middleware: User created successfully");
        return;
      } catch (error) {
        console.log("Auth middleware: Error creating user:", error.message);
        return ctx.badRequest(error.message);
      }
    }

    // For non-registration requests, continue to next middleware
    await next();
  };
};
