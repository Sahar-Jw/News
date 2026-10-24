import { RolePermission } from '../modules/access/role-permission.entity';
import { Permission } from '../modules/access/permission.entity';
import { Role } from '../modules/access/role.entity';
import { AuditLog } from '../modules/audit/audit-log.entity';
import { City } from '../modules/cities/city.entity';
import { Country } from '../modules/countries/country.entity';
import { ContactMessage } from '../modules/contact/contact-message.entity';
import { PasswordReset } from '../modules/auth/password-reset.entity';
import { Ad } from '../modules/ads/ad.entity';
import { Subscriber } from '../modules/subscribers/subscriber.entity';
import { Gallery } from '../modules/gallery/gallery.entity';
import { Occasion } from '../modules/occasions/occasion.entity';
import { News } from '../modules/news/news.entity';
import { SiteSetting } from '../modules/settings/site-setting.entity';
import { User } from '../modules/users/user.entity';

/** Single registration point for TypeORM; each entity lives inside its own feature module. */
export const ALL_ENTITIES = [User, Role, Permission, RolePermission, News, City, Country, AuditLog, SiteSetting, ContactMessage, Occasion, Gallery, Subscriber, Ad, PasswordReset];
