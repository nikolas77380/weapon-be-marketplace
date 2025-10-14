/**
 * Custom auth controller for email confirmation
 */

export default {
  async confirm(ctx) {
    try {
      console.log("=== EMAIL CONFIRMATION CONTROLLER CALLED ===");
      console.log("Confirmation token:", ctx.query.confirmation);

      const { confirmation } = ctx.query;

      if (!confirmation) {
        return ctx.badRequest("Confirmation token is required");
      }

      // Find user by confirmation token
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            confirmationToken: confirmation,
          },
          populate: {
            role: true,
            metadata: true,
          },
        });

      if (!user) {
        return ctx.badRequest("Invalid confirmation token");
      }

      if (user.confirmed) {
        return ctx.badRequest("Account is already confirmed");
      }

      // Update user to confirmed
      const updatedUser = await strapi
        .query("plugin::users-permissions.user")
        .update({
          where: { id: user.id },
          data: {
            confirmed: true,
            confirmationToken: null, // Clear the token
          },
          populate: {
            role: true,
            metadata: true,
          },
        });

      // Generate JWT token
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: updatedUser.id,
      });

      // Remove sensitive data
      const {
        password: _,
        resetPasswordToken: __,
        confirmationToken: ___,
        ...userWithoutSensitiveData
      } = updatedUser;

      console.log("✅ Email confirmation successful for user:", user.email);

      return {
        jwt,
        user: userWithoutSensitiveData,
        message: "Акаунт успішно підтверджено!",
      };
    } catch (error) {
      console.error("Email confirmation error:", error);
      return ctx.internalServerError("Internal server error");
    }
  },
};
