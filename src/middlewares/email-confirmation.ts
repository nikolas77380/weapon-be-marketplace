/**
 * Middleware для обработки email подтверждения при регистрации
 */

export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Проверяем, что это запрос на регистрацию
    if (
      ctx.request.url === "/api/auth/local/register" &&
      ctx.request.method === "POST"
    ) {
      console.log("=== EMAIL CONFIRMATION MIDDLEWARE CALLED ===");
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
        const user = await strapi.plugins[
          "users-permissions"
        ].services.user.add({
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
          // Use Strapi's built-in email confirmation system
          const confirmationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/confirm?confirmation=${user.confirmationToken}`;

          // Load email template
          const fs = require("fs");
          const path = require("path");
          const templatePath = path.join(
            __dirname,
            "../extensions/users-permissions/email-templates",
            "email-confirmation.html"
          );
          const textTemplatePath = path.join(
            __dirname,
            "../extensions/users-permissions/email-templates",
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

        // Return custom response
        ctx.body = {
          message:
            "Реєстрація успішна! Будь ласка, перевірте вашу email та підтвердіть акаунт.",
          user: userWithoutSensitiveData,
        };

        return; // Don't call next() to prevent default registration
      } catch (error) {
        console.error("Registration error:", error);
        return ctx.badRequest(error.message);
      }
    }

    // For all other requests, continue to next middleware
    await next();
  };
};
