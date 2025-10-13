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

        // Create user with role (not confirmed initially)
        const userData = {
          email,
          username,
          password,
          displayName,
          provider: "local",
          confirmed: false, // Require email confirmation
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

        // Send email confirmation using Strapi's built-in email system
        try {
          // Generate confirmation token manually (since Strapi 5.x doesn't have this method)
          const crypto = require("crypto");
          const confirmationToken = crypto.randomBytes(32).toString("hex");

          // Update user with confirmation token
          await strapi.entityService.update(
            "plugin::users-permissions.user",
            user.id,
            {
              data: {
                confirmationToken: confirmationToken,
              },
            }
          );
          const confirmationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/confirm?confirmation=${confirmationToken}`;

          // Send email using Strapi's email service
          await strapi.plugins.email.services.email.send({
            to: email,
            subject: "Підтвердження email - esviem-defence",
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <title>Підтвердження email</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
                  .content { padding: 20px; background: #f9f9f9; }
                  .button { display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>esviem-defence</h1>
                  </div>
                  <div class="content">
                    <h2>Ласкаво просимо!</h2>
                    <p>Привіт, <strong>${username}</strong>!</p>
                    <p>Дякуємо за реєстрацію на нашій платформі. Для завершення реєстрації, будь ласка, підтвердіть ваш email адрес.</p>
                    <p style="text-align: center;">
                      <a href="${confirmationUrl}" class="button">Підтвердити Email</a>
                    </p>
                    <p>Якщо кнопка не працює, скопіюйте та вставте це посилання у ваш браузер:</p>
                    <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 3px;">${confirmationUrl}</p>
                    <p>Це посилання дійсне протягом 24 годин.</p>
                  </div>
                  <div class="footer">
                    <p>&copy; 2025 esviem-defence. Всі права захищені.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
            text: `
              Ласкаво просимо до esviem-defence!
              
              Привіт, ${username}!
              
              Дякуємо за реєстрацію на нашій платформі. Для завершення реєстрації, будь ласка, підтвердіть ваш email адрес.
              
              Підтвердити email: ${confirmationUrl}
              
              Це посилання дійсне протягом 24 годин.
              
              З повагою,
              Команда esviem-defence
            `,
          });

          console.log("✅ Confirmation email sent via Namecheap to:", email);
        } catch (emailError) {
          console.error("❌ Failed to send confirmation email:", emailError);
          // Don't fail registration if email fails, but log the error
        }

        // Fetch the user again to get all fields
        const fullUser = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          user.id,
          {
            populate: ["role", "metadata"],
          }
        );

        console.log("Auth middleware: Full user data:", fullUser);

        // Don't generate JWT token for unconfirmed users
        // User needs to confirm email first

        // Return the response without JWT
        const response = {
          message:
            "Реєстрація успішна! Будь ласка, перевірте вашу email та підтвердіть акаунт.",
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
