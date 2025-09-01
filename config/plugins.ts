export default () => ({
  "users-permissions": {
    config: {
      jwt: {
        expiresIn: "30d",
      },
    },
  },
  // Temporarily disable S3 and use local storage for testing
  // upload: {
  //   config: {
  //     provider: "aws-s3",
  //     providerOptions: {
  //       accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  //       secretAccessKey: process.env.AWS_ACCESS_SECRET,
  //       region: process.env.AWS_REGION,
  //       params: {
  //         Bucket: process.env.AWS_BUCKET,
  //       },
  //     },
  //     actionOptions: {
  //       upload: {
  //         ACL: "public-read",
  //       },
  //       uploadStream: {
  //         ACL: "public-read",
  //       },
  //       delete: {},
  //     },
  //   },
  // },
});
