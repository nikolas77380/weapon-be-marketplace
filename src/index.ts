import type { Core } from "@strapi/strapi";
import userServiceOverride from "./extensions/users-permissions/services/user";

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    console.log("Registering custom overrides");
    userServiceOverride(strapi.plugins["users-permissions"]);
    console.log("Custom overrides registered");
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Seed Tags (idempotent)
    const tags = [
      "new",
      "used",
      "export",
      "demilitarized",
      "5.45mm",
      "7.62mm",
      "9mm",
      "12ga",
      "82mm",
      "120mm",
      "122mm",
      "152mm",
      "optics",
      "night-vision",
      "thermal",
      "Ukraine",
      "USA",
      "EU",
    ];

    for (const name of tags) {
      const exists = await strapi.entityService.findMany(
        "api::tag.tag" as any,
        {
          filters: { name: name },
          limit: 1,
        }
      );
      if (!exists.length) {
        await strapi.entityService.create("api::tag.tag" as any, {
          data: { name, slug: name.toLowerCase().replace(/\s+/g, "-") },
        });
      }
    }

    // Seed Categories (flat create, then link parents)
    const categories: Record<
      string,
      { name: string; parent?: string; order?: number }
    > = {
      weapons: { name: "Weapons", order: 1 },
      "small-arms": { name: "Small Arms", parent: "weapons", order: 1 },
      pistols: { name: "Pistols", parent: "small-arms", order: 1 },
      rifles: { name: "Rifles", parent: "small-arms", order: 2 },
      "sniper-rifles": {
        name: "Sniper Rifles",
        parent: "small-arms",
        order: 3,
      },
      shotguns: { name: "Shotguns", parent: "small-arms", order: 4 },
      "machine-guns": { name: "Machine Guns", parent: "small-arms", order: 5 },

      "heavy-weapons": { name: "Heavy Weapons", parent: "weapons", order: 2 },
      "grenade-launchers": {
        name: "Grenade Launchers",
        parent: "heavy-weapons",
      },
      "rocket-launchers": { name: "Rocket Launchers", parent: "heavy-weapons" },
      "anti-tank": { name: "Anti-Tank Weapons", parent: "heavy-weapons" },

      ammunition: { name: "Ammunition", order: 2 },
      "small-arms-ammo": { name: "Small Arms Ammo", parent: "ammunition" },
      "artillery-shells": { name: "Artillery Shells", parent: "ammunition" },
      "mortar-shells": { name: "Mortar Shells", parent: "ammunition" },
      missiles: { name: "Missiles", parent: "ammunition" },

      drones: { name: "Drones", order: 3 },
      "recon-drones": { name: "Reconnaissance Drones", parent: "drones" },
      "combat-drones": { name: "Combat Drones", parent: "drones" },
      "kamikaze-drones": { name: "Kamikaze Drones", parent: "drones" },

      vehicles: { name: "Vehicles", order: 4 },
      "armored-vehicles": { name: "Armored Vehicles", parent: "vehicles" },
      tanks: { name: "Tanks", parent: "vehicles" },
      trucks: { name: "Trucks", parent: "vehicles" },
      apc: { name: "APC (Armored Personnel Carriers)", parent: "vehicles" },
    };

    // create or find
    const created: Record<string, any> = {};
    for (const slug of Object.keys(categories)) {
      const def = categories[slug];
      const existing = await strapi.entityService.findMany(
        "api::category.category" as any,
        {
          filters: { slug },
          limit: 1,
        }
      );
      if (existing.length) {
        created[slug] = existing[0].id;
      } else {
        const rec = await strapi.entityService.create(
          "api::category.category" as any,
          {
            data: { name: def.name, slug, order: def.order ?? 0 },
          }
        );
        created[slug] = rec.id;
      }
    }
    // link parents
    for (const [slug, def] of Object.entries(categories)) {
      if (!def.parent) continue;
      const id = created[slug];
      const parentId = created[def.parent];
      await strapi.entityService.update("api::category.category" as any, id, {
        data: { parent: parentId },
      });
    }
  },
};
