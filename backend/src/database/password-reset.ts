import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Role } from '../modules/access/role.entity';
import { User } from '../modules/users/user.entity';

/**
 * Emergency access, driven by environment variables (for when nobody can log in and there is no shell / SQL access):
 *
 *   RESET_USER_EMAIL=technical@news.local     the account to repair
 *   RESET_USER_PASSWORD=<at least 8 chars>    its new password
 *   RESET_USER_ROLE=technical_admin           optional: also set this role (a code from the roles table)
 *
 * On start-up the account gets the new password and is activated; if the e-mail does not exist yet it is created
 * (role: RESET_USER_ROLE, default technical_admin). REMOVE the three variables afterwards, otherwise the password is
 * re-applied on every restart.
 */
export async function applyPasswordReset(ds: DataSource) {
  const log = new Logger('PasswordReset');
  const email = process.env.RESET_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.RESET_USER_PASSWORD;
  if (!email || !password) return;
  if (password.length < 8) {
    log.error('RESET_USER_PASSWORD must be at least 8 characters - nothing changed');
    return;
  }
  try {
    const users = ds.getRepository(User);
    const roles = ds.getRepository(Role);
    const roleCode = process.env.RESET_USER_ROLE?.trim();
    const role = roleCode ? await roles.findOne({ where: { code: roleCode } }) : null;
    if (roleCode && !role) {
      log.error(`RESET_USER_ROLE "${roleCode}" does not exist in the roles table - nothing changed`);
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await users.findOne({ where: { email }, select: { id: true } });
    if (user) {
      await users.update({ id: user.id }, { passwordHash, isActive: true, passwordChangedAt: new Date(), ...(role ? { roleId: role.id } : {}) });
      log.warn(`password of ${email} was reset and the account activated${role ? `, role set to ${role.code}` : ''} - REMOVE the RESET_USER_* variables now`);
    } else {
      const admin = role ?? (await roles.findOne({ where: { code: 'technical_admin' } }));
      if (!admin) {
        log.error('role technical_admin not found - user not created');
        return;
      }
      await users.save(users.create({ fullName: 'Technical Administrator', email, passwordHash, roleId: admin.id, isActive: true }));
      log.warn(`account ${email} created (role ${admin.code}) - REMOVE the RESET_USER_* variables now`);
    }
  } catch (e) {
    log.error(`reset failed - ${(e as Error).message}`);
  }
}
