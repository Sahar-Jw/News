import { IdempotencyInterceptor } from './common/idempotency.interceptor';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LocalizeInterceptor } from './common/i18n/localize.interceptor';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { validateEnv } from './config/env.validation';
import { buildDbOptions } from './database/db-options';
import { User } from './modules/users/user.entity';
import { AccessModule } from './modules/access/access.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CitiesModule } from './modules/cities/cities.module';
import { CountriesModule } from './modules/countries/countries.module';
import { ContactModule } from './modules/contact/contact.module';
import { FilesModule } from './modules/files/files.module';
import { MailModule } from './modules/mail/mail.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AdsModule } from './modules/ads/ads.module';
import { SubscribersModule } from './modules/subscribers/subscribers.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { BoardModule } from './modules/board/board.module';
import { CommitteesModule } from './modules/committees/committees.module';
import { MembershipModule } from './modules/membership/membership.module';
import { Get2TradeModule } from './modules/get2trade/get2trade.module';
import { ContentLinksModule } from './modules/content-links/content-links.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NavModule } from './modules/nav/nav.module';
import { FooterModule } from './modules/footer/footer.module';
import { ServicesModule } from './modules/services/services.module';
import { IncubatorModule } from './modules/incubator/incubator.module';
import { ExpoModule } from './modules/expo/expo.module';
import { TrainingModule } from './modules/training/training.module';
import { PagesModule } from './modules/pages/pages.module';
import { ContentModule } from './modules/content/content.module';
import { FaqsModule } from './modules/faqs/faqs.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { OccasionsModule } from './modules/occasions/occasions.module';
import { NewsModule } from './modules/news/news.module';
import { SiteSearchModule } from './modules/site-search/site-search.module';
import { HealthModule } from './modules/health/health.module';
import { mayCreateSchema } from './database/schema-guard';
import { prepareMigrations } from './database/migration-history';
import { SchemaBaselineService } from './database/schema-baseline.service';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { FormsModule } from './modules/forms/forms.module';
import { BackupModule } from './modules/backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (c: ConfigService) => {
        const dbEnv = {
          DB_HOST: c.get('DB_HOST'),
          DB_PORT: c.get('DB_PORT'),
          DB_USER: c.get('DB_USER'),
          DB_PASS: c.get('DB_PASS'),
          DB_NAME: c.get('DB_NAME'),
          DB_SCHEMA: c.get('DB_SCHEMA'),
          DB_SSL: c.get('DB_SSL'),
          DB_SSL_REJECT_UNAUTHORIZED: c.get('DB_SSL_REJECT_UNAUTHORIZED'),
        };
        // only a brand-new EMPTY database may create its tables this way; see database/schema-guard.ts (a database with data is never synchronized)
        const synchronize = await mayCreateSchema({ ...dbEnv, DB_SYNCHRONIZE: c.get('DB_SYNCHRONIZE') });
        // migrations run on start only when the database has a migration history (see database/migration-history.ts)
        const { run } = await prepareMigrations(
          { ...dbEnv, RUN_MIGRATIONS_ON_START: c.get('RUN_MIGRATIONS_ON_START'), MIGRATIONS_BASELINE: c.get('MIGRATIONS_BASELINE') },
          { schemaCreatedNow: synchronize },
        );
        return {
          ...buildDbOptions({
            ...dbEnv,
            DB_LOGGING: c.get('DB_LOGGING'),
            DB_POOL_MAX: c.get('DB_POOL_MAX'),
            DB_STATEMENT_TIMEOUT_MS: c.get('DB_STATEMENT_TIMEOUT_MS'),
          }),
          migrationsRun: run,
          // the database may still be starting when the API starts (both restarted together): wait for it - up to ~2.5 minutes - instead of giving up
          retryAttempts: 30,
          retryDelay: 5000,
          synchronize,
        };
      },
    }),
    TypeOrmModule.forFeature([User]), // the global guard needs the User repository
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuditModule,
    AccessModule,
    FilesModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    CitiesModule,
    CountriesModule,
    ContactModule,
    NewsModule,
    SiteSearchModule,
    HealthModule,
    OccasionsModule,
    ContentModule,
    FaqsModule,
    StatisticsModule,
    PagesModule,
    DocumentsModule,
    ServicesModule,
    NavModule,
    FooterModule,
    TrainingModule,
    ExpoModule,
    IncubatorModule,
    BoardModule,
    CommitteesModule,
    MembershipModule,
    Get2TradeModule,
    ContentLinksModule,
    GalleryModule,
    MailModule,
    SubscribersModule,
    AdsModule,
    CustomersModule,
    AppointmentsModule,
    FormsModule,
    BackupModule,
  ],
  providers: [
    // order matters: rate-limit -> authenticate -> authorize
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LocalizeInterceptor },
    SchemaBaselineService, // a database created from the entities in this start gets its migration history recorded
  ],
})
export class AppModule {}
