/**
 * product router
 */

import { factories } from "@strapi/strapi";

export default {
  routes: [
    {
      method: "GET",
      path: "/products/public",
      handler: "product.findPublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products/public/:id",
      handler: "product.findOnePublic",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products",
      handler: "product.find",
      config: {
        auth: {
          scope: ["find"],
        },
      },
    },
    {
      method: "GET",
      path: "/products/:id",
      handler: "product.findOne",
      config: {
        auth: {
          scope: ["findOne"],
        },
      },
    },
    {
      method: "POST",
      path: "/products",
      handler: "product.create",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/products/:id",
      handler: "product.update",
      config: {
        auth: {
          scope: ["update"],
        },
      },
    },
    {
      method: "DELETE",
      path: "/products/:id",
      handler: "product.delete",
      config: {
        auth: {
          scope: ["delete"],
        },
      },
    },
  ],
};
