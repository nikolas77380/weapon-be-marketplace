const sendbirdUtils = require("../../utils/sendbird");

const strapiServerOverride = (plugin) => {
  // Override the default register controller
  plugin.controllers.auth.register = async (ctx) => {
    console.log("=== CUSTOM REGISTER CONTROLLER CALLED ===");
    console.log("Request body:", ctx.request.body);

    const { email, username, password, displayName, role } = ctx.request.body;

    // Validate required fields
    if (!email || !username || !password || !displayName || !role) {
      console.log("Missing fields:", {
        email,
        username,
        password,
        displayName,
        role,
      });
      return ctx.badRequest(
        "Missing required fields: email, username, password, displayName, role"
      );
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
        console.log("Role not found:", role);
        return ctx.badRequest(
          `Role '${role}' not found. Please create it in Strapi Admin Panel first.`
        );
      }

      const roleId = roleEntity[0].id;

      // Create user with role
      const user = await strapi.plugins["users-permissions"].services.user.add({
        email,
        username,
        password,
        displayName,
        provider: "local",
        confirmed: true, // Auto-confirm users
        role: roleId,
      });

      // Get user with populated data
      const userWithData = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: user.id },
          populate: {
            role: true,
            metadata: {
              populate: "*",
            },
          },
        });

      // Generate JWT token
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      // Remove sensitive data
      const {
        password: _,
        resetPasswordToken: __,
        confirmationToken: ___,
        ...userWithoutSensitiveData
      } = userWithData;

      let sendbird = null;
      console.log("=== STARTING SENDBIRD INTEGRATION ===");
      try {
        console.log("Calling sendbirdEnsureUser...");
        await sendbirdUtils.ensureUser({
          userId: user.id,
          nickname: user.username || user.email,
          profile_url: user.avatar?.url,
        });
        console.log("sendbirdEnsureUser completed successfully");

        const ttl = process.env.SENDBIRD_SESSION_TTL_SECONDS || 86400;
        console.log("Calling issueSessionToken...");
        const { token, expires_at } = await sendbirdUtils.issueSessionToken({
          userId: user.id,
          ttlSeconds: ttl,
        });
        console.log("issueSessionToken completed successfully");

        sendbird = {
          app_id: process.env.SENDBIRD_APP_ID,
          user_id: String(user.id),
          session_token: token,
          expires_at,
        };
        console.log("Sendbird data created:", sendbird);
      } catch (e) {
        console.error("=== SENDBIRD ERROR ===", e);
        strapi.log.warn(
          `Sendbird on register failed uid=${user.id}: ${e.message}`
        );
      }

      return {
        jwt,
        user: userWithoutSensitiveData,
        sendbird,
      };
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  };

  // Override the default callback controller
  plugin.controllers.auth.callback = async (ctx) => {
    const { identifier, password } = ctx.request.body;

    const user = await strapi.query("plugin::users-permissions.user").findOne({
      where: {
        $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
      },
      populate: {
        role: true,
        metadata: {
          populate: "*",
        },
      },
    });

    if (!user) {
      throw new Error("Invalid identifier or password");
    }

    const validPassword = await strapi.plugins[
      "users-permissions"
    ].services.user.validatePassword(password, user.password);

    if (!validPassword) {
      throw new Error("Invalid identifier or password");
    }

    if (!user.confirmed) {
      throw new Error("Your account email is not confirmed");
    }

    if (user.blocked) {
      throw new Error("Your account has been blocked by an administrator");
    }

    const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
      id: user.id,
    });

    const {
      password: _,
      resetPasswordToken: __,
      confirmationToken: ___,
      ...userWithoutSensitiveData
    } = user;
    try {
      await sendbirdUtils.ensureUser({
        userId: user.id,
        nickname: user.username || user.email,
        profile_url: user.avatar?.url,
      });
    } catch (e) {
      strapi.log.warn(
        `Sendbird ensureUser on login failed uid=${user.id}: ${e.message}`
      );
    }

    let sendbird;
    try {
      const ttl = process.env.SENDBIRD_SESSION_TTL_SECONDS || 86400;
      const { token, expires_at } = await sendbirdUtils.issueSessionToken({
        userId: user.id,
        ttlSeconds: ttl,
      });
      sendbird = {
        app_id: process.env.SENDBIRD_APP_ID,
        user_id: String(user.id),
        session_token: token,
        expires_at,
      };
    } catch (e) {
      strapi.log.warn(
        `Sendbird session token issue failed uid=${user.id}: ${e.message}`
      );
      sendbird = null;
    }

    return {
      jwt,
      user: userWithoutSensitiveData,
      sendbird,
    };
  };

  // Override the default user controller with our custom one
  plugin.controllers.user = {
    ...plugin.controllers.user,
    ...require("./controllers/user").default,
  };

  return plugin;
};

export default strapiServerOverride;
