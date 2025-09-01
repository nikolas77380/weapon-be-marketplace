/**
 * order controller
 */

import { factories } from "@strapi/strapi";
import { createChannel } from "../../../utils/sendbird";

export default factories.createCoreController(
  "api::order.order" as any,
  ({ strapi }) => ({
    async create(ctx) {
      try {
        console.log("=== CREATE ORDER STARTED ===");
        console.log("Request body:", ctx.request.body);
        console.log("User state:", ctx.state.user);

        const { productId } = ctx.request.body;
        const currentUser = ctx.state.user;

        // Проверяем, что пользователь аутентифицирован
        if (!currentUser) {
          console.log("ERROR: User not authenticated");
          return ctx.unauthorized("Unauthorized");
        }

        console.log("User authenticated:", {
          id: currentUser.id,
          username: currentUser.username,
          role: currentUser.role?.name,
          roleId: currentUser.role?.id,
        });

        // Проверяем, что пользователь является покупателем
        if (currentUser.role?.name !== "buyer") {
          console.log(
            "ERROR: User is not a buyer. Role:",
            currentUser.role?.name
          );
          return ctx.forbidden("Only buyers can create orders");
        }

        // Проверяем обязательные поля
        if (!productId) {
          return ctx.badRequest("Missing required field: productId");
        }

        // Получаем информацию о продукте
        const product = await strapi.entityService.findOne(
          "api::product.product",
          productId,
          {
            populate: {
              seller: true,
              category: true,
            },
          }
        );

        if (!product) {
          return ctx.notFound("Product not found");
        }

        const productData = product as any;
        const sellerId = productData.seller?.id;
        const productTitle = productData.title;
        const sellerCompanyName =
          productData.seller?.companyName || productData.seller?.username;

        if (!sellerId) {
          return ctx.badRequest("Product seller information not found");
        }

        // Проверяем, что покупатель не пытается создать заказ на свой собственный продукт
        if (sellerId === currentUser.id) {
          return ctx.forbidden(
            "You cannot create an order for your own product"
          );
        }

        // Создаем название канала
        const channelName = sellerCompanyName
          ? `${sellerCompanyName} - ${productTitle}`
          : `Seller ${sellerId} - ${productTitle}`;

        console.log("Creating SendBird channel...");

        // Создаем канал в SendBird
        const channelResponse = await createChannel({
          sellerId: sellerId,
          buyerId: currentUser.id,
          channelName: channelName,
        });

        console.log("SendBird channel created:", channelResponse);
        console.log("Channel response structure:", {
          channel_id: channelResponse.channel_id,
          channel_url: channelResponse.channel_url,
          name: channelResponse.name,
        });

        // Проверяем, что у нас есть необходимые данные
        if (!channelResponse.channel_url) {
          console.error("Missing channel_url in SendBird response");
          return ctx.internalServerError("Failed to create SendBird channel");
        }

        // Создаем заказ в базе данных
        const orderData = {
          seller: sellerId,
          buyer: currentUser.id,
          status: "pending" as const,
          sendbirdChannelId:
            channelResponse.channel_id ||
            channelResponse.channel_url?.split("/").pop(),
          sendbirdChannelUrl: channelResponse.channel_url,
          product: productId,
        };

        console.log("Order data to create:", orderData);

        console.log("Creating order in database...");

        const order = (await strapi.entityService.create(
          "api::order.order" as any,
          {
            data: orderData,
            populate: {
              seller: true,
              buyer: true,
              product: true,
            },
          }
        )) as any;

        console.log("Order created successfully:", order);

        return ctx.send({
          success: true,
          order: {
            id: order.id,
            status: order.status,
            sendbirdChannelId: order.sendbirdChannelId,
            sendbirdChannelUrl: order.sendbirdChannelUrl,
          },
          channel: {
            channelUrl: channelResponse.channel_url,
            name: channelResponse.name,
            channelId:
              channelResponse.channel_id ||
              channelResponse.channel_url?.split("/").pop(),
          },
          product: {
            id: productData.id,
            title: productData.title,
            price: productData.price,
          },
          seller: {
            id: productData.seller.id,
            username: productData.seller.username,
            companyName: productData.seller.companyName,
          },
        });
      } catch (error) {
        console.error("=== CREATE ORDER ERROR ===");
        console.error("Error details:", error);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        return ctx.internalServerError("Internal server error");
      }
    },
  })
);
