/**
 * Auth controller for email confirmation
 */

export default {
  async confirm(ctx) {
    try {
      const { confirmation } = ctx.query;

      if (!confirmation) {
        return ctx.badRequest("Confirmation token is required");
      }

      console.log("Email confirmation request:", { confirmation });

      // Find user by confirmation token
      const user = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters: {
            confirmationToken: confirmation,
          },
          populate: {
            role: true,
            metadata: true,
          },
        }
      );

      if (!user || user.length === 0) {
        console.log("User not found with token:", confirmation);
        return ctx.badRequest("Invalid confirmation token");
      }

      const userToConfirm = user[0];

      // Check if user is already confirmed
      if (userToConfirm.confirmed) {
        console.log("User already confirmed:", userToConfirm.id);
        return ctx.badRequest("Account is already confirmed");
      }

      // Update user to confirmed status and clear token
      const updatedUser = await strapi.entityService.update(
        "plugin::users-permissions.user",
        userToConfirm.id,
        {
          data: {
            confirmed: true,
            confirmationToken: null,
          },
        }
      );

      console.log("User confirmed successfully:", updatedUser.id);

      // Generate JWT token for the confirmed user
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

      return {
        jwt,
        user: userWithoutSensitiveData,
        message: "Акаунт успішно підтверджено!",
      };
    } catch (error) {
      console.error("Error in email confirmation:", error);
      return ctx.internalServerError("Internal server error");
    }
  },
};
