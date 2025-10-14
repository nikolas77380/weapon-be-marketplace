/**
 * seller-meta controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::seller-meta.seller-meta",
  ({ strapi }) => ({
    async findPublic(ctx) {
      try {
        const { query } = ctx;

        const populate = {
          sellerEntity: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 10;

        const filters = { ...(query.filters as any) };

        const totalCount = await strapi.entityService.count(
          "api::seller-meta.seller-meta",
          {
            filters,
          }
        );

        const sellerMetas = await strapi.entityService.findMany(
          "api::seller-meta.seller-meta",
          {
            filters,
            sort: query.sort || ["createdAt:desc"],
            populate,
            start: (page - 1) * pageSize,
            limit: pageSize,
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);

        return ctx.send({
          data: sellerMetas,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount,
              total: totalCount,
            },
          },
        });
      } catch (error) {
        console.error("Error fetching public seller-metas:", error);
        return ctx.internalServerError("Failed to fetch seller metadata");
      }
    },

    async findOnePublic(ctx) {
      try {
        const { id } = ctx.params;

        const sellerMeta = await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: {
              sellerEntity: true,
            },
          }
        );

        if (!sellerMeta) {
          return ctx.notFound("Seller metadata not found");
        }

        return ctx.send(sellerMeta);
      } catch (error) {
        console.error("Error fetching public seller-meta:", error);
        return ctx.internalServerError("Failed to fetch seller metadata");
      }
    },

    async findBySellerPublic(ctx) {
      try {
        const { sellerId } = ctx.params;

        const sellerMeta = await strapi.entityService.findMany(
          "api::seller-meta.seller-meta",
          {
            filters: {
              sellerEntity: sellerId,
            },
            populate: {
              sellerEntity: true,
            },
          }
        );

        if (!sellerMeta || sellerMeta.length === 0) {
          return ctx.notFound("Seller metadata not found");
        }

        return ctx.send({ data: sellerMeta });
      } catch (error) {
        console.error("Error fetching seller-meta by seller:", error);
        return ctx.internalServerError("Failed to fetch seller metadata");
      }
    },
    async create(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can create seller metadata");
        }

        const existingMeta = await strapi.entityService.findMany(
          "api::seller-meta.seller-meta",
          {
            filters: {
              sellerEntity: user.id,
            },
          }
        );

        if (existingMeta.length > 0) {
          return ctx.badRequest("User already has seller metadata");
        }

        const result = await strapi.entityService.create(
          "api::seller-meta.seller-meta",
          {
            data: {
              ...ctx.request.body.data,
              sellerEntity: user.id,
            },
            populate: {
              sellerEntity: true,
            },
          }
        );

        return result;
      } catch (error) {
        console.error("Error creating seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async find(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can access seller metadata");
        }

        const sellerMeta = await strapi.entityService.findMany(
          "api::seller-meta.seller-meta",
          {
            filters: {
              sellerEntity: user.id,
            },
            populate: "*",
          }
        );

        return { data: sellerMeta };
      } catch (error) {
        console.error("Error finding seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async findOne(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can access seller metadata");
        }

        const { id } = ctx.params;

        const sellerMeta = (await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: {
              sellerEntity: true,
            },
          }
        )) as any;

        if (!sellerMeta || sellerMeta.sellerEntity?.id !== user.id) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        const result = await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: "*",
          }
        );

        return result;
      } catch (error) {
        console.error("Error finding seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async update(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can update seller metadata");
        }

        const { id } = ctx.params;

        const sellerMeta = (await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: {
              sellerEntity: true,
            },
          }
        )) as any;

        if (!sellerMeta || sellerMeta.sellerEntity?.id !== user.id) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        const result = await strapi.entityService.update(
          "api::seller-meta.seller-meta",
          id,
          {
            data: ctx.request.body.data,
          }
        );

        return result;
      } catch (error) {
        console.error("Error updating seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async delete(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can delete seller metadata");
        }

        const { id } = ctx.params;

        const sellerMeta = (await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: {
              sellerEntity: true,
            },
          }
        )) as any;

        if (!sellerMeta || sellerMeta.sellerEntity?.id !== user.id) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        await strapi.entityService.delete("api::seller-meta.seller-meta", id);

        return { success: true };
      } catch (error) {
        console.error("Error deleting seller-meta:", error);
        return ctx.badRequest(error.message);
      }
    },

    async uploadAvatar(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        if (user.role?.name !== "seller") {
          return ctx.forbidden("Only sellers can upload avatar");
        }

        const { id } = ctx.params;

        // Проверяем, что seller-meta принадлежит текущему пользователю
        const sellerMeta = (await strapi.entityService.findOne(
          "api::seller-meta.seller-meta",
          id,
          {
            populate: {
              sellerEntity: true,
            },
          }
        )) as any;

        if (!sellerMeta || sellerMeta.sellerEntity?.id !== user.id) {
          return ctx.forbidden("Access denied to this seller metadata");
        }

        // Проверяем наличие файла
        if (!ctx.request.files || !ctx.request.files["files.avatar"]) {
          return ctx.badRequest("No avatar file provided");
        }

        const file = ctx.request.files["files.avatar"];
        const fileArray = Array.isArray(file) ? file : [file];

        if (fileArray.length === 0) {
          return ctx.badRequest("No avatar file provided");
        }

        // Log file information for debugging
        const avatarFile = fileArray[0];
        console.log("Avatar file object:", avatarFile);
        console.log("Avatar file type:", (avatarFile as any).type);
        console.log("Avatar file mime:", (avatarFile as any).mime);
        console.log("Avatar file name:", (avatarFile as any).name);

        // Let Strapi handle file type validation through the schema
        // The schema now only allows "images" type, so Strapi will validate this

        // Загружаем файл
        const uploadedFile = await strapi.plugins.upload.services.upload.upload(
          {
            data: {
              refId: sellerMeta.id,
              ref: "api::seller-meta.seller-meta",
              field: "avatar",
            },
            files: fileArray[0],
          }
        );

        console.log("Uploaded avatar file:", uploadedFile);

        // Обновляем seller-meta с новым avatar
        const updateResult = await strapi.entityService.update(
          "api::seller-meta.seller-meta",
          sellerMeta.id,
          {
            data: {
              avatar: uploadedFile[0].id,
            },
            populate: "*",
          }
        );

        console.log("Seller-meta updated with avatar:", updateResult);

        return ctx.send({
          success: true,
          data: updateResult,
        });
      } catch (error) {
        console.error("Error uploading avatar:", error);
        return ctx.badRequest(error.message);
      }
    },
  })
);
