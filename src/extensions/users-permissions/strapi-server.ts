const strapiServerOverride = (plugin) => {
  // Temporarily disable custom registration to test standard flow
  /*
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

      // Create user with role (not confirmed initially)
      const user = await strapi.plugins["users-permissions"].services.user.add({
        email,
        username,
        password,
        displayName,
        provider: "local",
        confirmed: false, // Require email confirmation
        role: roleId,
      });

      // Use Strapi built-in email confirmation - let Strapi handle everything
      try {
        // Send confirmation email using Strapi's built-in method
        await strapi.plugins["users-permissions"].services.user.sendConfirmationEmail(user, {
          url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/confirm?confirmation=${user.confirmationToken}`,
        });

        console.log("✅ Confirmation email sent via Strapi to:", email);
      } catch (emailError) {
        console.error("❌ Failed to send confirmation email:", emailError);
        // Don't fail registration if email fails, but log the error
      }

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

      // Don't generate JWT token for unconfirmed users
      // User needs to confirm email first

      // Remove sensitive data
      const {
        password: _,
        resetPasswordToken: __,
        confirmationToken: ___,
        ...userWithoutSensitiveData
      } = userWithData;

      return {
        message:
          "Реєстрація успішна! Будь ласка, перевірте вашу email та підтвердіть акаунт.",
        user: userWithoutSensitiveData,
      };
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  };
  */

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

  // Add custom auth controller
  plugin.controllers.auth = {
    ...plugin.controllers.auth,
    ...require("./controllers/auth").default,
  };

  // Add custom routes
  plugin.routes = {
    ...plugin.routes,
    ...require("./routes/auth").default,
  };

  return plugin;
};

export default strapiServerOverride;
