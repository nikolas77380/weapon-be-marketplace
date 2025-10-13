export default ({ env }) => ({
  "users-permissions": {
    config: {
      jwt: {
        expiresIn: "30d",
      },
      register: {
        allowedFields: ["email", "username", "password", "displayName", "role"],
      },
    },
  },
  email: {
    config: {
      provider: "@strapi/provider-email-nodemailer",
      providerOptions: {
        host: env("NAMECHEAP_SMTP_HOST", "mail.privateemail.com"),
        port: parseInt(env("NAMECHEAP_SMTP_PORT", "587")),
        auth: {
          user: env("NAMECHEAP_SMTP_USERNAME"),
          pass: env("NAMECHEAP_SMTP_PASSWORD"),
        },
        secure: false, // Use STARTTLS instead of SSL
        requireTLS: true,
        tls: {
          rejectUnauthorized: false,
          ciphers: "SSLv3",
          secureProtocol: "TLSv1_2_method",
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      },
      settings: {
        defaultFrom: env("NAMECHEAP_DEFAULT_FROM", "noreply@yourdomain.com"),
        defaultReplyTo: env(
          "NAMECHEAP_DEFAULT_REPLY_TO",
          "noreply@yourdomain.com"
        ),
      },
    },
  },
  upload: {
    config: {
      provider: "@strapi/provider-upload-aws-s3",
      providerOptions: {
        s3Options: {
          region: env("AWS_REGION"),
          credentials: {
            accessKeyId: env("AWS_ACCESS_KEY_ID"),
            secretAccessKey: env("AWS_ACCESS_SECRET"),
          },
        },
        params: {
          Bucket: env("AWS_BUCKET"),
          ACL: "public-read",
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});
