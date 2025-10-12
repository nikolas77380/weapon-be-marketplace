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

      return {
        jwt,
        user: userWithoutSensitiveData,
      };
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  };

  // Override the default callback controller
  plugin.controllers.auth.callback = async (ctx) => {
    try {
      console.log("=== CUSTOM CALLBACK CONTROLLER CALLED ===");
      console.log("Request body:", ctx.request.body);
      const { identifier, password } = ctx.request.body;

      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            $or: [
              { email: identifier.toLowerCase() },
              { username: identifier },
            ],
          },
          populate: {
            role: true,
            metadata: true,
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
      return {
        jwt,
        user: userWithoutSensitiveData,
      };
    } catch (error) {
      console.error("=== CALLBACK CONTROLLER ERROR ===", error);
      return ctx.badRequest(error.message);
    }
  };

  // Override the default user controller with our custom one
  plugin.controllers.user = {
    ...plugin.controllers.user,
    ...require("./controllers/user").default,
  };

  return plugin;
};

export default strapiServerOverride;
