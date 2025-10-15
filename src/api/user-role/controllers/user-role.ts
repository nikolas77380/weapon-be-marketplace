export default {
  async test(ctx) {
    return ctx.send({ message: "Test endpoint working" });
  },

  async changeUserRole(ctx) {
    // Добавляем middleware для аутентификации
    await strapi.plugins["users-permissions"].services.jwt.verify(
      ctx.request.header.authorization?.replace("Bearer ", "")
    );

    // Получаем пользователя из токена
    const token = ctx.request.header.authorization?.replace("Bearer ", "");
    if (!token) {
      return ctx.unauthorized("Authentication required");
    }

    const decoded =
      await strapi.plugins["users-permissions"].services.jwt.verify(token);
    const currentUser = await strapi.plugins[
      "users-permissions"
    ].services.user.fetch(decoded.id);

    if (!currentUser) {
      return ctx.unauthorized("User not found");
    }
    try {
      const { id } = ctx.params;
      const { role } = ctx.request.body;

      // Проверяем, что ID пользователя валиден
      if (!id || isNaN(Number(id))) {
        return ctx.badRequest("Valid user ID is required");
      }

      // Проверяем, что роль указана
      if (!role) {
        return ctx.badRequest("Role is required");
      }

      // Проверяем, что роль валидна
      const validRoles = ["buyer", "seller"];
      if (!validRoles.includes(role)) {
        return ctx.badRequest("Invalid role. Must be 'buyer' or 'seller'");
      }

      // Получаем текущего пользователя с полной информацией
      const currentUserWithRole = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: currentUser.id },
          populate: {
            role: true,
          },
        });

      if (!currentUserWithRole) {
        return ctx.unauthorized("Current user not found");
      }

      // Логируем информацию о текущем пользователе для отладки
      console.log("Current user:", {
        id: currentUser.id,
        username: currentUser.username,
        role: currentUserWithRole.role,
      });

      // Проверяем, что текущий пользователь имеет права на изменение ролей
      // В данном случае разрешаем всем авторизованным пользователям
      // В будущем можно добавить проверку на admin роль
      const currentUserRole = currentUserWithRole.role?.name;
      if (!currentUserRole) {
        console.log(
          "Current user role not found, but allowing access for debugging"
        );
        // Временно разрешаем доступ для отладки
        // return ctx.forbidden("Current user role not found");
      }

      // Получаем пользователя, которого нужно изменить
      const targetUser = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id },
          populate: {
            role: true,
          },
        });

      if (!targetUser) {
        return ctx.notFound("User not found");
      }

      // Логируем информацию о целевом пользователе для отладки
      console.log("Target user:", {
        id: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
      });

      // Разрешаем пользователю изменять свою собственную роль
      // if (targetUser.id === currentUser.id) {
      //   return ctx.badRequest("You cannot change your own role");
      // }

      // Проверяем, что роль действительно изменилась
      if (targetUser.role?.name === role) {
        return ctx.badRequest(`User already has role '${role}'`);
      }

      // Получаем роль по имени
      const roleEntity = await strapi
        .query("plugin::users-permissions.role")
        .findOne({
          where: { name: role },
        });

      if (!roleEntity) {
        return ctx.badRequest(`Role '${role}' not found`);
      }

      // Логируем изменение роли для аудита
      console.log(
        `User ${currentUser.id} (${currentUser.username}) is changing role of user ${targetUser.id} (${targetUser.username}) from ${targetUser.role?.name} to ${role}`
      );

      // Обновляем роль пользователя
      const updatedUser = await strapi
        .query("plugin::users-permissions.user")
        .update({
          where: { id },
          data: {
            role: roleEntity.id,
          },
          populate: {
            role: true,
            metadata: {
              populate: {
                avatar: true,
              },
            },
          },
        });

      // Удаляем чувствительные данные
      const {
        password: _,
        resetPasswordToken: __,
        confirmationToken: ___,
        ...userWithoutSensitiveData
      } = updatedUser;

      return ctx.send({
        data: userWithoutSensitiveData,
        message: `User role successfully changed from ${targetUser.role?.name} to ${role}`,
        previousRole: targetUser.role?.name,
        newRole: role,
      });
    } catch (error) {
      console.error("Error changing user role:", error);
      return ctx.internalServerError("Failed to change user role");
    }
  },
};
