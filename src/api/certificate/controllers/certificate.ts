/**
 * certificate controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::certificate.certificate",
  ({ strapi }) => ({
    async findPublic(ctx) {
      try {
        const { query } = ctx;

        const populate = {
          certificateFile: true,
          seller: true,
          product: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 10;
        const filters = { ...(query.filters as any) };

        const totalCount = await strapi.entityService.count(
          "api::certificate.certificate",
          { filters }
        );

        const certificates = await strapi.entityService.findMany(
          "api::certificate.certificate",
          {
            filters,
            sort: query.sort,
            populate,
            start: (page - 1) * pageSize,
            limit: pageSize,
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);

        return ctx.send({
          data: certificates,
          meta: {
            pagination: { page, pageSize, pageCount, total: totalCount },
          },
        });
      } catch (error) {
        console.error("Error fetching public certificates:", error);
        return ctx.internalServerError("Failed to fetch certificates");
      }
    },

    async findOnePublic(ctx) {
      try {
        const { id } = ctx.params;
        const certificate = await strapi.entityService.findOne(
          "api::certificate.certificate",
          id,
          {
            populate: {
              certificateFile: true,
              seller: true,
              product: true,
            },
          }
        );

        if (!certificate) {
          return ctx.notFound("Certificate not found");
        }

        return ctx.send(certificate);
      } catch (error) {
        console.error("Error fetching public certificate:", error);
        return ctx.internalServerError("Failed to fetch certificate");
      }
    },

    async find(ctx) {
      try {
        const { query } = ctx;
        const populate = {
          certificateFile: true,
          seller: true,
          product: true,
        };

        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 10;
        const filters = { ...(query.filters as any) };

        const totalCount = await strapi.entityService.count(
          "api::certificate.certificate",
          { filters }
        );

        const certificates = await strapi.entityService.findMany(
          "api::certificate.certificate",
          {
            filters,
            sort: query.sort,
            populate,
            start: (page - 1) * pageSize,
            limit: pageSize,
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);
        return ctx.send({
          data: certificates,
          meta: {
            pagination: { page, pageSize, pageCount, total: totalCount },
          },
        });
      } catch (error) {
        console.error("Error fetching certificates:", error);
        return ctx.internalServerError("Failed to fetch certificates");
      }
    },

    async findOne(ctx) {
      try {
        const { id } = ctx.params;
        const certificate = await strapi.entityService.findOne(
          "api::certificate.certificate",
          id,
          {
            populate: {
              certificateFile: true,
              seller: true,
              product: true,
            },
          }
        );
        if (!certificate) {
          return ctx.notFound("Certificate not found");
        }
        return ctx.send(certificate);
      } catch (error) {
        console.error("Error fetching certificate:", error);
        return ctx.internalServerError("Failed to fetch certificate");
      }
    },

    async create(ctx) {
      try {
        console.log("Certificate controller: Creating certificate");
        console.log("Request body:", ctx.request.body);
        console.log("Request files:", ctx.request.files);

        // Check if user is authenticated
        if (!ctx.state.user) {
          console.log("Certificate controller: User not authenticated");
          return ctx.unauthorized(
            "User must be authenticated to create a certificate"
          );
        }

        console.log(
          "Certificate controller: User authenticated:",
          ctx.state.user.id
        );

        const { data } = ctx.request.body;

        if (!data) {
          console.log("Certificate controller: Missing data payload");
          return ctx.badRequest("Missing 'data' payload in the request body");
        }

        // Parse data if it's a string
        const certificateData =
          typeof data === "string" ? JSON.parse(data) : data;

        // Add seller to certificate data
        const finalCertificateData = {
          ...certificateData,
          seller: ctx.state.user.id,
        };

        console.log(
          "Certificate controller: Parsed data:",
          finalCertificateData
        );

        // First create the certificate without files
        const certificate = await strapi.entityService.create(
          "api::certificate.certificate",
          {
            data: finalCertificateData,
          }
        );

        console.log(
          "Certificate controller: Certificate created:",
          certificate
        );

        // If there are files, upload them separately and link to certificate
        if (ctx.request.files && ctx.request.files["files.certificateFile"]) {
          console.log("Uploading certificate file separately...");

          const file = ctx.request.files["files.certificateFile"];
          const fileArray = Array.isArray(file) ? file : [file];

          // Upload each file
          for (const fileItem of fileArray) {
            console.log(
              "Uploading certificate file:",
              (fileItem as any).name,
              (fileItem as any).size
            );

            const uploadedFile =
              await strapi.plugins.upload.services.upload.upload({
                data: {
                  refId: certificate.id,
                  ref: "api::certificate.certificate",
                  field: "certificateFile",
                },
                files: fileItem,
              });

            console.log("Uploaded certificate file:", uploadedFile);

            // Update certificate with the uploaded file
            const updateResult = await strapi.entityService.update(
              "api::certificate.certificate",
              certificate.id,
              {
                data: {
                  certificateFile: uploadedFile[0].id,
                },
              }
            );

            console.log("Certificate updated with file:", updateResult);
          }
        }

        // Get the final certificate with file
        const finalCertificate = await strapi.entityService.findOne(
          "api::certificate.certificate",
          certificate.id,
          {
            populate: {
              certificateFile: true,
              seller: true,
              product: true,
            },
          }
        );

        console.log("Final certificate with file:", finalCertificate);

        return { data: finalCertificate || certificate };
      } catch (error) {
        console.error(
          "Certificate controller: Error creating certificate:",
          error
        );
        return ctx.badRequest(error.message || "Failed to create certificate");
      }
    },

    async update(ctx) {
      try {
        const { id } = ctx.params;
        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to update a certificate"
          );
        }

        let data;
        if (ctx.request.body.data) {
          data =
            typeof ctx.request.body.data === "string"
              ? JSON.parse(ctx.request.body.data)
              : ctx.request.body.data;
        } else {
          data = ctx.request.body;
        }

        const existing = await strapi.entityService.findOne(
          "api::certificate.certificate",
          id,
          { populate: { seller: true } }
        );
        if (!existing) {
          return ctx.notFound("Certificate not found");
        }
        const ownerId = Number((existing as any).seller?.id);
        const currentUserId = Number(ctx.state.user.id);
        if (ownerId !== currentUserId) {
          return ctx.forbidden("You can only update your own certificates");
        }

        const updateOptions: any = {
          data,
          populate: { certificateFile: true, seller: true, product: true },
        };

        if (ctx.request.files && ctx.request.files["files.certificateFile"]) {
          updateOptions.files = {
            certificateFile: ctx.request.files["files.certificateFile"],
          };
        }

        const updated = await strapi.entityService.update(
          "api::certificate.certificate",
          Number(id),
          updateOptions
        );

        return ctx.send(updated);
      } catch (error) {
        console.error("Error updating certificate:", error);
        return ctx.internalServerError("Failed to update certificate");
      }
    },

    async delete(ctx) {
      try {
        const { id } = ctx.params;
        if (!ctx.state.user) {
          return ctx.unauthorized(
            "User must be authenticated to delete a certificate"
          );
        }

        const existing = await strapi.entityService.findOne(
          "api::certificate.certificate",
          id,
          { populate: { seller: true } }
        );
        if (!existing) {
          return ctx.notFound("Certificate not found");
        }
        if ((existing as any).seller?.id !== ctx.state.user.id) {
          return ctx.forbidden("You can only delete your own certificates");
        }

        await strapi.entityService.delete("api::certificate.certificate", id);
        return ctx.send({ message: "Certificate deleted successfully" });
      } catch (error) {
        console.error("Error deleting certificate:", error);
        return ctx.internalServerError("Failed to delete certificate");
      }
    },

    async listByUser(ctx) {
      try {
        const userIdParam = ctx.params.userId || ctx.query.userId;
        const userId = Number(userIdParam);
        if (!userId) {
          return ctx.badRequest("userId is required");
        }

        const { query } = ctx;
        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 10;

        const filters = {
          ...(query.filters as any),
          seller: { id: { $eq: userId } },
        } as any;

        const totalCount = await strapi.entityService.count(
          "api::certificate.certificate",
          { filters }
        );

        const certificates = await strapi.entityService.findMany(
          "api::certificate.certificate",
          {
            filters,
            start: (page - 1) * pageSize,
            limit: pageSize,
            sort: query.sort,
            populate: { certificateFile: true, seller: true, product: true },
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);
        return ctx.send({
          data: certificates,
          meta: {
            pagination: { page, pageSize, pageCount, total: totalCount },
          },
        });
      } catch (error) {
        console.error("Error listing certificates by user:", error);
        return ctx.internalServerError("Failed to fetch certificates");
      }
    },

    async listByProduct(ctx) {
      try {
        const productIdParam = ctx.params.productId || ctx.query.productId;
        const productId = Number(productIdParam);
        if (!productId) {
          return ctx.badRequest("productId is required");
        }

        const { query } = ctx;
        const page = Number((query.pagination as any)?.page) || 1;
        const pageSize = Number((query.pagination as any)?.pageSize) || 10;

        const filters = {
          ...(query.filters as any),
          product: { id: { $eq: productId } },
        } as any;

        const totalCount = await strapi.entityService.count(
          "api::certificate.certificate",
          { filters }
        );

        const certificates = await strapi.entityService.findMany(
          "api::certificate.certificate",
          {
            filters,
            start: (page - 1) * pageSize,
            limit: pageSize,
            sort: query.sort,
            populate: { certificateFile: true, seller: true, product: true },
          }
        );

        const pageCount = Math.ceil(totalCount / pageSize);
        return ctx.send({
          data: certificates,
          meta: {
            pagination: { page, pageSize, pageCount, total: totalCount },
          },
        });
      } catch (error) {
        console.error("Error listing certificates by product:", error);
        return ctx.internalServerError("Failed to fetch certificates");
      }
    },
  })
);
