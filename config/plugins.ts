export default ({ env }) => ({
  "users-permissions": {
    config: {
      jwt: {
        expiresIn: "30d",
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
