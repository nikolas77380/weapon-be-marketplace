export default {
  async findOne(ctx) {
    const { id } = ctx.params;

    try {
      // Get user with populated data including avatar
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id },
          populate: {
            role: true,
            metadata: {
              populate: {
                avatar: true,
              },
            },
          },
        });

      if (!user) {
        return ctx.notFound("User not found");
      }

      // Remove sensitive data
      const {
        password: _,
        resetPasswordToken: __,
        confirmationToken: ___,
        ...userWithoutSensitiveData
      } = user;

      return userWithoutSensitiveData;
    } catch (error) {
      console.error("Error in findOne controller:", error);
      return ctx.internalServerError("Internal server error");
    }
  },

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
            metadata: {
              populate: {
                avatar: true,
              },
            },
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

  async searchSellers(ctx) {
    try {
      const { query } = ctx;
      const searchTerm = query.search as string;

      if (!searchTerm || searchTerm.trim().length === 0) {
        return ctx.badRequest("Search term is required");
      }

      const populate = {
        role: true,
        metadata: {
          populate: {
            avatar: true,
          },
        },
        products: {
          populate: {
            images: true,
            category: true,
          },
        },
      };

      const page = Number((query.pagination as any)?.page) || 1;
      const pageSize = Number((query.pagination as any)?.pageSize) || 10;

      // Создаем фильтры для поиска продавцов
      const filters: any = {
        $or: [
          // Поиск по имени пользователя (displayName)
          {
            displayName: {
              $containsi: searchTerm.trim(),
            },
          },
          // Поиск по имени компании
          {
            metadata: {
              companyName: {
                $containsi: searchTerm.trim(),
              },
            },
          },
          // Поиск по специализации
          {
            metadata: {
              specialisation: {
                $containsi: searchTerm.trim(),
              },
            },
          },
        ],
      };

      const totalCount = await strapi.entityService.count(
        "plugin::users-permissions.user",
        {
          filters,
        }
      );

      const sellers = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters,
          sort: query.sort || [{ createdAt: "desc" }],
          populate,
          start: (page - 1) * pageSize,
          limit: pageSize,
        }
      );

      // Remove sensitive data from sellers
      const sanitizedSellers = sellers.map((seller: any) => {
        const {
          password: _,
          resetPasswordToken: __,
          confirmationToken: ___,
          ...sellerWithoutSensitiveData
        } = seller;
        return sellerWithoutSensitiveData;
      });

      const pageCount = Math.ceil(totalCount / pageSize);

      return ctx.send({
        data: sanitizedSellers,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount,
            total: totalCount,
          },
          searchTerm: searchTerm.trim(),
        },
      });
    } catch (error) {
      console.error("Error searching sellers:", error);
      return ctx.internalServerError("Failed to search sellers");
    }
  },

  async searchSellersPublic(ctx) {
    try {
      const { query } = ctx;
      const searchTerm = query.search as string;

      if (!searchTerm || searchTerm.trim().length === 0) {
        return ctx.badRequest("Search term is required");
      }

      const populate = {
        role: true,
        metadata: {
          populate: {
            avatar: true,
          },
        },
        products: {
          populate: {
            images: true,
            category: true,
          },
        },
      };

      const page = Number((query.pagination as any)?.page) || 1;
      const pageSize = Number((query.pagination as any)?.pageSize) || 10;

      // Создаем фильтры для поиска продавцов
      const filters: any = {
        $or: [
          // Поиск по имени пользователя (displayName)
          {
            displayName: {
              $containsi: searchTerm.trim(),
            },
          },
          // Поиск по имени компании
          {
            metadata: {
              companyName: {
                $containsi: searchTerm.trim(),
              },
            },
          },
          // Поиск по специализации
          {
            metadata: {
              specialisation: {
                $containsi: searchTerm.trim(),
              },
            },
          },
        ],
      };

      const totalCount = await strapi.entityService.count(
        "plugin::users-permissions.user",
        {
          filters,
        }
      );

      const sellers = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters,
          sort: query.sort || [{ createdAt: "desc" }],
          populate,
          start: (page - 1) * pageSize,
          limit: pageSize,
        }
      );

      // Remove sensitive data from sellers
      const sanitizedSellers = sellers.map((seller: any) => {
        const {
          password: _,
          resetPasswordToken: __,
          confirmationToken: ___,
          ...sellerWithoutSensitiveData
        } = seller;
        return sellerWithoutSensitiveData;
      });

      const pageCount = Math.ceil(totalCount / pageSize);

      return ctx.send({
        data: sanitizedSellers,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount,
            total: totalCount,
          },
          searchTerm: searchTerm.trim(),
        },
      });
    } catch (error) {
      console.error("Error searching public sellers:", error);
      return ctx.internalServerError("Failed to search sellers");
    }
  },

  async changeUserRole(ctx) {
    try {
      const { id } = ctx.params;
      const { role } = ctx.request.body;
      const currentUser = ctx.state.user;

      // Проверяем, что пользователь авторизован
      if (!currentUser) {
        return ctx.unauthorized("Authentication required");
      }

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

      // Проверяем, что текущий пользователь имеет права на изменение ролей
      // В данном случае разрешаем всем авторизованным пользователям
      // В будущем можно добавить проверку на admin роль
      const currentUserRole = currentUserWithRole.role?.name;
      if (!currentUserRole) {
        return ctx.forbidden("Current user role not found");
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

      // Проверяем, что пользователь не пытается изменить свою роль
      if (targetUser.id === currentUser.id) {
        return ctx.badRequest("You cannot change your own role");
      }

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
