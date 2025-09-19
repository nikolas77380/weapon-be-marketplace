import type { Core } from "@strapi/strapi";
import userServiceOverride from "./extensions/users-permissions/services/user";
import strapiServerOverride from "./extensions/users-permissions/strapi-server";
import { ensureUser } from "./utils/sendbird";

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    console.log("=== REGISTERING CUSTOM OVERRIDES ===");
    console.log("Registering user service override...");
    userServiceOverride(strapi.plugins["users-permissions"]);
    console.log("Registering strapi server override...");
    strapiServerOverride(strapi.plugins["users-permissions"]);
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
      { name: string; parent?: string; order?: number; translate_ua?: string }
    > = {
      weapons: { name: "Weapons", order: 1, translate_ua: "Стрілецька зброя" },

      // Small Arms Categories
      "small-arms": {
        name: "Small Arms",
        parent: "weapons",
        order: 1,
        translate_ua: "Стрілецька зброя",
      },

      // Pistols and Revolvers
      "pistols-revolvers": {
        name: "Pistols and Revolvers",
        parent: "small-arms",
        order: 1,
        translate_ua: "Пістолети та револьвери",
      },

      // Submachine Guns
      "submachine-guns": {
        name: "Submachine Guns (SMG)",
        parent: "small-arms",
        order: 2,
        translate_ua: "Пістолети-кулемети (ПП)",
      },

      // Shotguns
      shotguns: {
        name: "Shotguns",
        parent: "small-arms",
        order: 3,
        translate_ua: "Гладкоствольна зброя (рушниці)",
      },

      // Carbines/Rifles
      "carbines-rifles": {
        name: "Carbines/Rifles",
        parent: "small-arms",
        order: 4,
        translate_ua: "Карабіни/гвинтівки",
      },

      // Assault Rifles
      "assault-rifles": {
        name: "Assault Rifles (AR/AK-class)",
        parent: "small-arms",
        order: 5,
        translate_ua: "Штурмові (AR/АК-клас)",
      },

      // Modular/PDW
      "modular-pdw": {
        name: "Modular/PDW",
        parent: "small-arms",
        order: 6,
        translate_ua: "Модульні/PDW",
      },

      // Marksman Rifles
      "marksman-rifles": {
        name: "Marksman Rifles (DMR)",
        parent: "small-arms",
        order: 7,
        translate_ua: "Марксманські (DMR)",
      },

      // Sniper Rifles
      "sniper-rifles": {
        name: "Sniper Rifles",
        parent: "small-arms",
        order: 8,
        translate_ua:
          "Снайперські (болт/напівавтомат), анти-матеріальні (.50 тощо)",
      },

      // Machine Guns
      "machine-guns": {
        name: "Machine Guns",
        parent: "small-arms",
        order: 9,
        translate_ua: "Кулемети",
      },
      "light-machine-guns": {
        name: "Light Machine Guns (LMG)",
        parent: "machine-guns",
        order: 1,
        translate_ua: "Ручні (LMG)",
      },
      "general-purpose-mg": {
        name: "General Purpose Machine Guns (GPMG)",
        parent: "machine-guns",
        order: 2,
        translate_ua: "Єдині/станкові (GPMG)",
      },
      "heavy-machine-guns": {
        name: "Heavy Machine Guns (HMG)",
        parent: "machine-guns",
        order: 3,
        translate_ua: "Великокаліберні (HMG)",
      },

      // Grenade Launchers
      "grenade-launchers": {
        name: "Grenade Launchers",
        parent: "weapons",
        order: 2,
        translate_ua: "Гранатомети",
      },
      "underbarrel-grenade-launchers": {
        name: "Underbarrel Grenade Launchers (40mm)",
        parent: "grenade-launchers",
        order: 1,
        translate_ua: "Підствольні (40 мм)",
      },
      "handheld-grenade-launchers": {
        name: "Handheld Multi-shot Grenade Launchers (RPG)",
        parent: "grenade-launchers",
        order: 2,
        translate_ua: "Ручні багаторазові (РПГ)",
      },
      "disposable-grenade-launchers": {
        name: "Disposable Grenade Launchers/FAUST",
        parent: "grenade-launchers",
        order: 3,
        translate_ua: "Одноразові ППГ/фаустпатрони",
      },
      "automatic-grenade-launchers": {
        name: "Automatic Grenade Launchers (AGS)",
        parent: "grenade-launchers",
        order: 4,
        translate_ua: "АГС",
      },

      // Anti-tank/Anti-material
      "anti-tank-anti-material": {
        name: "Anti-tank/Anti-material Small Unit Weapons",
        parent: "weapons",
        order: 3,
        translate_ua: "Протитанкові/протиматеріальні засоби малих підрозділів",
      },
      "portable-atgm": {
        name: "Portable Anti-tank Guided Missiles (ATGM)",
        parent: "anti-tank-anti-material",
        order: 1,
        translate_ua: "ПТРК переносні",
      },
      "reactive-grenades": {
        name: "Reactive Grenades",
        parent: "anti-tank-anti-material",
        order: 2,
        translate_ua: "Реактивні гранати",
      },

      // Non-lethal Weapons
      "non-lethal-weapons": {
        name: "Non-lethal Weapons",
        parent: "weapons",
        order: 4,
        translate_ua: "Нелетальні засоби",
      },
      "traumatic-weapons": {
        name: "Traumatic Weapons",
        parent: "non-lethal-weapons",
        order: 1,
        translate_ua: "Травматичні",
      },
      "rubber-bullets": {
        name: "Rubber Bullets",
        parent: "non-lethal-weapons",
        order: 2,
        translate_ua: "Гумові кулі",
      },
      "flash-bang": {
        name: "Flash-bang Grenades",
        parent: "non-lethal-weapons",
        order: 3,
        translate_ua: "Світлошумові",
      },
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
            data: {
              name: def.name,
              slug,
              order: def.order ?? 0,
              translate_ua: def.translate_ua || null,
            },
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
    strapi.db.lifecycles.subscribe({
      models: ["plugin::users-permissions.user"], // Applies only to users in users-permissions

      /**
       * Lifecycle hook triggered after a new user is created.
       * Ensures that a user profile is created with either the provided full name and bio
       * or a default generated username and bio if missing.
       * @param {any} event - The event object containing the created user's details.
       */
      async afterCreate(event) {
        const { result } = event;
        console.log("afterCreate result:", result);
        console.log(
          "process.env.SENDBIRD_APP_ID:",
          process.env.SENDBIRD_APP_ID
        );
        console.log(
          "process.env.SENDBIRD_API_TOKEN:",
          process.env.SENDBIRD_API_TOKEN
        );
        try {
          const createSendbirdUser = await ensureUser({
            userId: result.id,
            nickname: result.username,
            profile_url: "https://google.com",
          });

          strapi.log.info(
            `Sendbird result:`,
            JSON.stringify(createSendbirdUser, null, 2)
          );
          strapi.log.info(`Sendbird user ensured for uid=${result.id}`);
        } catch (e) {
          strapi.log.warn(
            `Sendbird ensureUser failed for uid=${result.id}: ${e.message}`
          );
        }
      },
    });
  },
};
