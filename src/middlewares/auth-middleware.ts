const sendbirdUtils = require("../utils/sendbird");

export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Check if this is a registration request
    if (
      ctx.request.url === "/api/auth/local/register" &&
      ctx.request.method === "POST"
    ) {
      console.log("Auth middleware: Processing registration request");
      console.log("Request body:", ctx.request.body);

      const { email, username, password, displayName, role } = ctx.request.body;

      // Validate required fields
      if (!email || !username || !password || !displayName || !role) {
        console.log("Auth middleware: Missing required fields");
        return ctx.badRequest(
          "Missing required fields: email, username, password, displayName, role"
        );
      }

      // Validate role
      if (!["seller", "buyer"].includes(role)) {
        console.log("Auth middleware: Invalid role");
        return ctx.badRequest("Invalid role. Must be 'seller' or 'buyer'");
      }

      try {
        // Get role ID from database
        const roleEntity = await strapi.entityService.findMany(
          "plugin::users-permissions.role",
          {
            filters: {
              name: role,
            },
          }
        );

        if (!roleEntity || roleEntity.length === 0) {
          console.log("Auth middleware: Role not found in database");
          return ctx.badRequest(
            `Role '${role}' not found. Please create it in Strapi Admin Panel first.`
          );
        }

        const roleId = roleEntity[0].id;

        // Create user with role
        const userData = {
          email,
          username,
          password,
          displayName,
          provider: "local",
          confirmed: true, // Auto-confirm users
          role: roleId,
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
            populate: ["role", "metadata"],
          }
        );

        console.log("Auth middleware: Full user data:", fullUser);

        // Generate JWT token
        const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
          id: user.id,
        });

        // Generate Sendbird session token
        let sendbirdSessionToken = null;
        try {
          console.log("Auth middleware: Starting Sendbird integration");
          await sendbirdUtils.ensureUser({
            userId: user.id,
            nickname: user.username || user.email,
            profile_url: user.avatar?.url,
          });
          console.log("Auth middleware: Sendbird user ensured");

          const ttl = process.env.SENDBIRD_SESSION_TTL_SECONDS || 86400;
          const { token, expires_at } = await sendbirdUtils.issueSessionToken({
            userId: user.id,
            ttlSeconds: ttl,
          });
          console.log("Auth middleware: Sendbird session token generated");

          sendbirdSessionToken = token;
        } catch (e) {
          console.error("Auth middleware: Sendbird error:", e);
          strapi.log.warn(
            `Sendbird on register failed uid=${user.id}: ${e.message}`
          );
        }

        // Return the response directly
        const response = {
          jwt,
          user: {
            id: fullUser.id,
            username: fullUser.username,
            email: fullUser.email,
            displayName: fullUser.displayName,
            role: fullUser.role,
            confirmed: fullUser.confirmed,
            blocked: fullUser.blocked,
            createdAt: fullUser.createdAt,
            updatedAt: fullUser.updatedAt,
            metadata: fullUser.metadata,
          },
          sendbirdSessionToken,
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

    // For all other requests, continue to next middleware
    await next();
  };
};
