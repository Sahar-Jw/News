import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import dataSource from './data-source';
import { NewsStatus, PERMISSIONS, Visibility } from '../common/constants';
import { Permission } from '../modules/access/permission.entity';
import { RolePermission } from '../modules/access/role-permission.entity';
import { Role } from '../modules/access/role.entity';
import { City } from '../modules/cities/city.entity';
import { ContactMessage } from '../modules/contact/contact-message.entity';
import { News } from '../modules/news/news.entity';
import { SiteSetting } from '../modules/settings/site-setting.entity';
import { User } from '../modules/users/user.entity';
import { CITY_SEEDS, CONTACT_MESSAGE_SEEDS, NEWS_SEEDS, ROLE_SEEDS, SETTING_SEEDS } from './seed-data';

/**
 * Idempotent: safe to run on every deploy.
 *  - permissions / settings: inserted when missing, never overwritten
 *  - roles: created when missing; default permissions are assigned ONLY on creation
 *  - first admin: created only when SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD are set and the email is new
 *  - demo users/content: created only when SEED_DEMO_DATA=true; demo users also require a password
 *  - demo content: inserted when missing, never overwritten or deleted
 */
async function main() {
  await dataSource.initialize();
  const cityRepo = dataSource.getRepository(City);
  const contactRepo = dataSource.getRepository(ContactMessage);
  const newsRepo = dataSource.getRepository(News);
  const permRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(Role);
  const rpRepo = dataSource.getRepository(RolePermission);
  const setRepo = dataSource.getRepository(SiteSetting);
  const userRepo = dataSource.getRepository(User);

  let addedPerms = 0;
  let addedCities = 0;
  let addedNews = 0;
  let addedMessages = 0;
  let addedUsers = 0;

  for (const p of PERMISSIONS) {
    if (!(await permRepo.findOne({ where: { code: p.code } }))) {
      await permRepo.save(permRepo.create(p));
      addedPerms++;
    }
  }
  const allPerms = await permRepo.find();

  const cities = new Map<string, City>();
  for (const seed of CITY_SEEDS) {
    let city = await cityRepo.findOne({ where: { code: seed.code } });
    if (!city) {
      city = await cityRepo.save(cityRepo.create({ ...seed, numericValue: null, stringValue: null, type: null }));
      addedCities++;
    }
    cities.set(seed.code, city);
  }

  for (const r of ROLE_SEEDS) {
    let role = await roleRepo.findOne({ where: { code: r.code } });
    if (!role) {
      role = await roleRepo.save(roleRepo.create({ code: r.code, nameAr: r.nameAr, nameEn: r.nameEn, type: r.type }));
      const codes = r.permissions === '*' ? allPerms.map((p) => p.code) : r.permissions;
      for (const code of codes) {
        const perm = allPerms.find((p) => p.code === code);
        if (perm) await rpRepo.save(rpRepo.create({ roleId: role.id, permissionId: perm.id }));
      }
      console.log(`+ role ${r.code} (${codes.length} permissions)`);
    }
  }

  // New permissions added in later versions are granted to technical_admin automatically.
  const tech = await roleRepo.findOne({ where: { code: 'technical_admin' } });
  if (tech) {
    const have = new Set((await rpRepo.find({ where: { roleId: tech.id } })).map((x) => x.permissionId));
    for (const p of allPerms) if (!have.has(p.id)) await rpRepo.save(rpRepo.create({ roleId: tech.id, permissionId: p.id }));
  }

  let addedSettings = 0;
  for (const st of SETTING_SEEDS) {
    if (!(await setRepo.findOne({ where: { category: st.category, key: st.key } }))) {
      await setRepo.save(setRepo.create({ category: st.category, key: st.key, value: st.value, valueType: st.type }));
      addedSettings++;
    }
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const pass = process.env.SEED_ADMIN_PASSWORD;
  if (email && pass && tech) {
    if (pass.length < 8) throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');
    if (!(await userRepo.findOne({ where: { email } }))) {
      await userRepo.save(
        userRepo.create({
          fullName: process.env.SEED_ADMIN_NAME || 'System Administrator',
          email,
          passwordHash: await bcrypt.hash(pass, 12),
          roleId: tech.id,
          isActive: true,
        }),
      );
      addedUsers++;
      console.log(`+ admin user ${email}`);
    }
  }

  const seedDemoData = process.env.SEED_DEMO_DATA === 'true';
  if (seedDemoData) {
    const demoPassword = process.env.DEMO_USERS_PASSWORD;
    if (!demoPassword || demoPassword.length < 8) {
      throw new Error('Set DEMO_USERS_PASSWORD to a value at least 8 characters long when SEED_DEMO_DATA=true');
    }
    const demoUsers = [
      {
        fullName: 'Sample Editor',
        email: 'editor@example.test',
        roleCode: 'content_editor',
        cityCode: 'riyadh',
        bio: 'Sample editor account for local development and preview.',
      },
      {
        fullName: 'Sample Reader',
        email: 'reader@example.test',
        roleCode: 'registered',
        cityCode: 'cairo',
        bio: 'Sample member account for local development and preview.',
      },
    ];
    for (const seed of demoUsers) {
      if (await userRepo.findOne({ where: { email: seed.email } })) continue;
      const role = await roleRepo.findOne({ where: { code: seed.roleCode } });
      if (!role) throw new Error(`Required seed role is missing: ${seed.roleCode}`);
      await userRepo.save(
        userRepo.create({
          fullName: seed.fullName,
          email: seed.email,
          passwordHash: await bcrypt.hash(demoPassword, 12),
          roleId: role.id,
          phone: null,
          gender: null,
          country: null,
          cityId: cities.get(seed.cityCode)?.id ?? null,
          nationality: null,
          isActive: true,
          avatarPath: null,
          bio: seed.bio,
          cvPath: null,
          socialLink: null,
          isExpert: false,
          isResearcher: false,
        }),
      );
      addedUsers++;
      console.log(`+ demo user ${seed.email}`);
    }

    const editor = await userRepo.findOne({ where: { email: 'editor@example.test' } });
    const admin = email ? await userRepo.findOne({ where: { email } }) : null;
    const contentAuthorId = editor?.id ?? admin?.id ?? null;
    for (const [index, seed] of NEWS_SEEDS.entries()) {
      if (await newsRepo.findOne({ where: { title: seed.title, language: seed.language } })) continue;
      await newsRepo.save(
        newsRepo.create({
          ...seed,
          subcategory: seed.subcategory ?? null,
          images: [],
          rating: seed.rating ?? null,
          isFeatured: seed.isFeatured ?? false,
          publishAt: new Date(Date.now() - index * 60 * 60 * 1000),
          status: NewsStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
          viewCount: 0,
          createdById: contentAuthorId,
        }),
      );
      addedNews++;
    }

    for (const seed of CONTACT_MESSAGE_SEEDS) {
      if (await contactRepo.findOne({ where: { email: seed.email, subject: seed.subject } })) continue;
      await contactRepo.save(contactRepo.create({ ...seed, isRead: false, readAt: null }));
      addedMessages++;
    }
  } else {
    console.log('Demo data skipped; set SEED_DEMO_DATA=true to add demo users, news, and contact messages.');
  }

  console.log(
    `Seed complete: ${addedPerms} permissions, ${addedSettings} settings, ${addedCities} cities, ${addedUsers} users, ${addedNews} news items, ${addedMessages} contact messages added.`,
  );
  await dataSource.destroy();
}

main().catch(async (e) => {
  console.error(e);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
