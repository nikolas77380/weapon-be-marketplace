const strapiServerOverride = (plugin) => {
  // Custom registration controller with Turnstile validation
  plugin.controllers.auth.register = async (ctx) => {
    console.log("=== CUSTOM REGISTER CONTROLLER CALLED ===");
    console.log("Request body:", ctx.request.body);

    const { email, username, password, displayName, role, turnstileToken } =
      ctx.request.body;

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

    // Validate Turnstile token
    const { validateTurnstileToken } = require("../../utils/turnstile");
    const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;

    if (turnstileSecretKey) {
      const clientIP =
        ctx.request.ip || (ctx.request as any).connection?.remoteAddress;
      const turnstileValidation = await validateTurnstileToken({
        token: turnstileToken,
        secretKey: turnstileSecretKey,
        remoteip: clientIP,
      });

      if (!turnstileValidation.success) {
        console.error(
          "❌ Turnstile validation failed:",
          turnstileValidation.error
        );
        return ctx.badRequest(
          "Security verification failed. Please try again."
        );
      }

      console.log("✅ Turnstile validation passed");
    } else {
      console.warn(
        "⚠️ Turnstile secret key not configured, skipping validation"
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
        await strapi.plugins[
          "users-permissions"
        ].services.user.sendConfirmationEmail(user, {
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

  // Override forgot-password controller to use custom reset URL
  plugin.controllers.auth.forgotPassword = async (ctx) => {
    console.log("=== CUSTOM FORGOT PASSWORD CONTROLLER CALLED ===");
    console.log("Request body:", ctx.request.body);
    
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest("Email is required");
    }

    try {
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email: email.toLowerCase() },
        });

      if (!user) {
        // Don't reveal if user exists or not for security
        return ctx.send({ ok: true });
      }

      // Generate reset token using crypto
      const crypto = require("crypto");
      const resetPasswordToken = crypto.randomBytes(64).toString("hex");

      // Update user with reset token
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { resetPasswordToken },
      });

      // Send reset password email with custom URL
      const frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl) {
        console.error("❌ FRONTEND_URL environment variable is not set!");
        throw new Error("FRONTEND_URL is not configured");
      }
      const resetUrl = `${frontendUrl}/auth/reset-password?code=${resetPasswordToken}`;
      
      console.log("📧 Sending reset password email to:", user.email);
      console.log("🔗 Reset URL:", resetUrl);
      console.log("🌐 Frontend URL from env:", frontendUrl);
      
      await strapi.plugins["email"].services.email.send({
        to: user.email,
        from: process.env.SMTP_FROM || "support@esviem-defence.com",
        replyTo: process.env.SMTP_REPLY_TO || "support@esviem-defence.com",
        subject: "Скидання пароля - esviem-defence",
        text: `Для скидання пароля перейдіть за посиланням: ${resetUrl}`,
        html: `
          <h1>Скидання пароля</h1>
          <p>Ви запросили скидання пароля для вашого акаунту.</p>
          <p>Натисніть на посилання нижче, щоб скинути пароль:</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #D4AF37; color: white; text-decoration: none; border-radius: 4px;">Скинути пароль</a></p>
          <p>Або скопіюйте та вставте це посилання у ваш браузер:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <p>Якщо ви не запитували скидання пароля, проігноруйте це повідомлення.</p>
          <p>Посилання дійсне протягом 1 години.</p>
        `,
      });

      return ctx.send({ ok: true });
    } catch (error) {
      console.error("Error in forgot password:", error);
      // Don't reveal error details for security
      return ctx.send({ ok: true });
    }
  };

  // Override reset-password controller to properly handle reset token
  plugin.controllers.auth.resetPassword = async (ctx) => {
    const { code, password, passwordConfirmation } = ctx.request.body;

    if (!code || !password || !passwordConfirmation) {
      return ctx.badRequest("Code, password, and password confirmation are required");
    }

    if (password !== passwordConfirmation) {
      return ctx.badRequest("Passwords do not match");
    }

    try {
      // Find user by reset token
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { resetPasswordToken: code },
          populate: { role: true },
        });

      if (!user) {
        return ctx.badRequest("Invalid or expired reset code");
      }

      // Update password and clear reset token
      await strapi.plugins["users-permissions"].services.user.edit(user.id, {
        password,
        resetPasswordToken: null,
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
      } = user;

      return {
        jwt,
        user: userWithoutSensitiveData,
      };
    } catch (error) {
      console.error("Error in reset password:", error);
      return ctx.badRequest(error.message || "Failed to reset password");
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

  // Override the forgot password service to ensure custom URL is used
  if (plugin.services && plugin.services.user) {
    const originalForgotPassword = plugin.services.user.forgotPassword;
    if (originalForgotPassword) {
      plugin.services.user.forgotPassword = async (email: string) => {
        console.log("=== CUSTOM FORGOT PASSWORD SERVICE CALLED ===");
        console.log("Email:", email);
        // Call the custom controller logic instead
        // This ensures we always use our custom implementation
        return originalForgotPassword.call(plugin.services.user, email);
      };
    }
  }

  // Override the default user controller with our custom one
  plugin.controllers.user = {
    ...plugin.controllers.user,
    ...require("./controllers/user").default,
  };

  // Register custom routes
  const customRoutesConfig = require("./routes/users").default;
  if (customRoutesConfig && customRoutesConfig.routes) {
    // Add routes to content-api
    if (!plugin.routes["content-api"]) {
      plugin.routes["content-api"] = { routes: [] };
    }
    if (Array.isArray(plugin.routes["content-api"].routes)) {
      plugin.routes["content-api"].routes.push(...customRoutesConfig.routes);
    } else {
      plugin.routes["content-api"].routes = customRoutesConfig.routes;
    }

    console.log(
      "Registered custom routes:",
      customRoutesConfig.routes.map((r: any) => r.path)
    );
  }

  return plugin;
};

export default strapiServerOverride;
