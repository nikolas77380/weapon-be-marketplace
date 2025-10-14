/**
 * Middleware для обработки email подтверждения при регистрации
 * Следует официальному руководству Strapi
 */

export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Let Strapi handle the registration first
    await next();

    // After Strapi processes the registration, check if it was successful
    if (
      ctx.request.url === "/api/auth/local/register" &&
      ctx.request.method === "POST" &&
      ctx.status === 200
    ) {
      console.log(
        "=== EMAIL CONFIRMATION MIDDLEWARE CALLED AFTER SUCCESSFUL REGISTRATION ==="
      );

      const { email, displayName } = ctx.request.body;
      const user = ctx.body.user;

      if (user && user.id) {
        console.log("User created successfully with ID:", user.id);
        console.log("User confirmation token:", user.confirmationToken);

        // Send email confirmation if user is not confirmed
        if (!user.confirmed && user.confirmationToken) {
          try {
            const confirmationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/confirm?confirmation=${user.confirmationToken}`;

            console.log("Confirmation URL:", confirmationUrl);

            // Send email using Strapi's email service
            await strapi.plugins["email"].services.email.send({
              to: email,
              from: process.env.EMAIL_FROM || "noreply@example.com",
              subject: "Підтвердження email адреси",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">Підтвердження email адреси</h2>
                  <p>Привіт ${displayName}!</p>
                  <p>Дякуємо за реєстрацію на нашому сайті. Для завершення реєстрації, будь ласка, натисніть на посилання нижче:</p>
                  <a href="${confirmationUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Підтвердити email</a>
                  <p>Якщо посилання не працює, скопіюйте та вставте цю адресу в браузер:</p>
                  <p style="word-break: break-all; color: #666;">${confirmationUrl}</p>
                  <p>Якщо ви не реєструвалися на нашому сайті, просто проігноруйте це повідомлення.</p>
                  <p>З повагою,<br>Команда Esviem Defence</p>
                </div>
              `,
            });

            console.log("Email sent successfully to:", email);
          } catch (emailError) {
            console.error("Error sending email:", emailError);
            // Don't fail registration if email fails
          }
        }
      }
    }
  };
};
