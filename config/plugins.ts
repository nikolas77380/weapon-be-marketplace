export default ({ env }) => ({
  "users-permissions": {
    config: {
      jwt: {
        expiresIn: "30d",
      },
      register: {
        allowedFields: ["email", "username", "password", "displayName", "role"],
      },
      emailConfirmation: {
        enabled: true,
        template: {
          subject: "Підтвердження email - esviem-defence",
          html: `
            <h1>Ласкаво просимо до esviem-defence!</h1>
            <p>Привіт!</p>
            <p>Підтвердіть ваш email: <a href="<%= URL %>?confirmation=<%= TOKEN %>">Підтвердити</a></p>
            <p>Посилання: <%= URL %>?confirmation=<%= TOKEN %></p>
          `,
          text: `Ласкаво просимо! Підтвердіть email: <%= URL %>?confirmation=<%= TOKEN %>`,
        },
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
        defaultFrom: "support@esviem-defence.com",
        defaultReplyTo: "support@esviem-defence.com",
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
