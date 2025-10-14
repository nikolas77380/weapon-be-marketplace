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
};
