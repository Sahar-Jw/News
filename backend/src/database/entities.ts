import { RolePermission } from '../modules/access/role-permission.entity';
import { Permission } from '../modules/access/permission.entity';
import { Role } from '../modules/access/role.entity';
import { AuditLog } from '../modules/audit/audit-log.entity';
import { City } from '../modules/cities/city.entity';
import { Country } from '../modules/countries/country.entity';
import { ContactMessage } from '../modules/contact/contact-message.entity';
import { PasswordReset } from '../modules/auth/password-reset.entity';
import { Appointment } from '../modules/appointments/appointment.entity';
import { Customer } from '../modules/customers/customer.entity';
import { Ad } from '../modules/ads/ad.entity';
import { Subscriber } from '../modules/subscribers/subscriber.entity';
import { Gallery } from '../modules/gallery/gallery.entity';
import { MembershipApplication, MembershipFile, MembershipSettings } from '../modules/membership/membership.entity';
import { G2tBooking, Get2TradeSettings } from '../modules/get2trade/get2trade.entity';
import { ContentLink } from '../modules/content-links/content-link.entity';
import { NavGroup, NavItem } from '../modules/nav/nav.entity';
import { IncubatorApplication } from '../modules/incubator/incubator-application.entity';
import { ExpoApplication } from '../modules/expo/expo-application.entity';
import { CourseRegistration } from '../modules/training/course-registration.entity';
import { TrainerApplication } from '../modules/training/trainer-application.entity';
import { News } from '../modules/news/news.entity';
import { SiteSetting } from '../modules/settings/site-setting.entity';
import { User } from '../modules/users/user.entity';
import { FooterGroup, FooterLink } from '../modules/footer/footer.entity';

/** Single registration point for TypeORM; each entity lives inside its own feature module. */
export const ALL_ENTITIES = [User, Role, Permission, RolePermission, News, City, Country, AuditLog, SiteSetting, ContactMessage, Gallery, Subscriber, Ad, PasswordReset, Customer, Appointment, CourseRegistration, TrainerApplication, ContentLink, NavGroup, NavItem, ExpoApplication, MembershipSettings, MembershipApplication, MembershipFile, Get2TradeSettings, G2tBooking, IncubatorApplication, FooterGroup, FooterLink];
