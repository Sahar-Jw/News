import { AuditLog } from './audit-log.entity';
import { City } from './city.entity';
import { ContactMessage } from './contact-message.entity';
import { News } from './news.entity';
import { Permission } from './permission.entity';
import { RolePermission } from './role-permission.entity';
import { Role } from './role.entity';
import { SiteSetting } from './site-setting.entity';
import { User } from './user.entity';

export { AuditLog, City, ContactMessage, News, Permission, RolePermission, Role, SiteSetting, User };
export const ALL_ENTITIES = [User, Role, Permission, RolePermission, News, City, AuditLog, SiteSetting, ContactMessage];
