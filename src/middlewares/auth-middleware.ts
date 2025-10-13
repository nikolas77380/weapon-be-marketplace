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

        // Send email confirmation
        try {
          const confirmationToken =
            await strapi.plugins[
              "users-permissions"
            ].services.user.generateConfirmationToken(user);
          const confirmationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/confirm?confirmation=${confirmationToken}`;

          // Simple email template
          const htmlContent = `
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

          const textContent = `Ласкаво просимо! Підтвердіть email: ${confirmationUrl}`;

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
