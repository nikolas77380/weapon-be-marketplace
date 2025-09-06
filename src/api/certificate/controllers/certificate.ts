/**
 * certificate controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::certificate.certificate",
  ({ strapi }) => ({
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
  })
);
