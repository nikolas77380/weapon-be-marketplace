export default [
  "strapi::logger",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "dl.airtable.com",
            process.env.AWS_S3_URL ||
              `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
          ],
          "media-src": [
            "'self'",
            "data:",
            "blob:",
            "dl.airtable.com",
            process.env.AWS_S3_URL ||
              `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      enabled: true,
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        process.env.FRONTEND_URL || "http://localhost:3000",
        "https://esviem-defence.com", // Ваш продакшен домен
        "https://www.esviem-defence.com", // С www
        "https://esviem-defence.com/auth/confirmation-success", // Конкретная страница
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      headers: [
        "Content-Type",
        "Authorization",
        "Origin",
        "Accept",
        "X-Requested-With",
      ],
      keepHeadersOnError: true,
      credentials: true, // Важно для CORS с credentials
    },
  },
  "strapi::poweredBy",
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
  {
    name: "global::auth-middleware",
    config: {},
  },
  // {
  //   name: "global::email-confirmation",
  //   config: {},
  // },
];
