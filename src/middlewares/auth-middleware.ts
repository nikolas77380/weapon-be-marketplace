export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Use standard Strapi functionality - no custom logic
    await next();
  };
};
