export default {
  async me(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized();
    }

    try {
      // Get user with populated data
      const userWithData = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: user.id },
          populate: {
            role: true,
            metadata: true,
          },
        });

      if (!userWithData) {
        return ctx.notFound("User not found");
      }

      // Remove sensitive data
      const {
        password: _,
        resetPasswordToken: __,
        confirmationToken: ___,
        ...userWithoutSensitiveData
      } = userWithData;

      return userWithoutSensitiveData;
    } catch (error) {
      console.error("Error in me controller:", error);
      return ctx.internalServerError("Internal server error");
    }
  },
};
