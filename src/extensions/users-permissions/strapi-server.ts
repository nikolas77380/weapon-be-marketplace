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

      // Send email confirmation via Namecheap
      try {
        const confirmationToken =
          await strapi.plugins[
            "users-permissions"
          ].services.user.generateConfirmationToken(user);
        const confirmationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/confirm?confirmation=${confirmationToken}`;

        // Load email template
        const fs = require("fs");
        const path = require("path");
        const templatePath = path.join(
          __dirname,
          "email-templates",
          "email-confirmation.html"
        );
        const textTemplatePath = path.join(
          __dirname,
          "email-templates",
          "email-confirmation.txt"
        );

        let htmlTemplate = "";
        let textTemplate = "";

        try {
          htmlTemplate = fs.readFileSync(templatePath, "utf8");
          textTemplate = fs.readFileSync(textTemplatePath, "utf8");
        } catch (templateError) {
          console.log("Using fallback email template");
          // Fallback template
          htmlTemplate = `
            <!DOCTYPE html>
            <html>
            <head><title>Підтвердження email</title></head>
            <body>
              <h1>Ласкаво просимо до esviem-defence!</h1>
              <p>Привіт, <strong>${username}</strong>!</p>
              <p>Підтвердіть ваш email: <a href="${confirmationUrl}">Підтвердити</a></p>
              <p>Посилання: ${confirmationUrl}</p>
            </body>
            </html>
          `;
          textTemplate = `Ласкаво просимо! Підтвердіть email: ${confirmationUrl}`;
        }

        // Replace placeholders
        const htmlContent = htmlTemplate
          .replace(/%USERNAME%/g, username)
          .replace(/%URL%/g, confirmationUrl);

        const textContent = textTemplate
          .replace(/%USERNAME%/g, username)
          .replace(/%URL%/g, confirmationUrl);

        await strapi.plugins.email.services.email.send({
          to: email,
          subject: "Підтвердження email - esviem-defence",
          html: htmlContent,
          text: textContent,
        });

        console.log("✅ Confirmation email sent via Namecheap to:", email);
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

  // Add email confirmation controller
  plugin.controllers.auth.confirm = async (ctx) => {
    try {
      console.log("=== EMAIL CONFIRMATION CONTROLLER CALLED ===");
      const { confirmation } = ctx.query;

      if (!confirmation) {
        return ctx.badRequest("Confirmation token is required");
      }

      // Find user by confirmation token
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { confirmationToken: confirmation },
          populate: {
            role: true,
            metadata: true,
          },
        });

      if (!user) {
        return ctx.badRequest("Invalid confirmation token");
      }

      // Check if token is expired (24 hours)
      const tokenAge =
        Date.now() - new Date(user.confirmationTokenCreatedAt).getTime();
      const tokenMaxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (tokenAge > tokenMaxAge) {
        return ctx.badRequest(
          "Confirmation token has expired. Please request a new one."
        );
      }

      // Confirm the user
      await strapi.plugins["users-permissions"].services.user.edit(user.id, {
        confirmed: true,
        confirmationToken: null,
        confirmationTokenCreatedAt: null,
      });

      // Generate JWT token for the confirmed user
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
        message:
          "Email успішно підтверджено! Ласкаво просимо до esviem-defence!",
      };
    } catch (error) {
      console.error("=== EMAIL CONFIRMATION ERROR ===", error);
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
