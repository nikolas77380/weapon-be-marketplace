export default (plugin) => {
  // Override the user service
  const originalAdd = plugin.services.user.add;

  plugin.services.user.add = async (values) => {
    console.log("Custom user service: Adding user with values:", values);

    // Call the original add method
    const user = await originalAdd.call(plugin.services.user, values);

    console.log("Custom user service: User created:", user);

    // Return the user with all fields
    return user;
  };

  return plugin;
};
