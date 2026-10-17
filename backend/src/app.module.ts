import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
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
import { ContactModule } from './modules/contact/contact.module';
import { FilesModule } from './modules/files/files.module';
import { NewsModule } from './modules/news/news.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        ...buildDbOptions({
          DB_HOST: c.get('DB_HOST'),
          DB_PORT: c.get('DB_PORT'),
          DB_USER: c.get('DB_USER'),
          DB_PASS: c.get('DB_PASS'),
          DB_NAME: c.get('DB_NAME'),
          DB_LOGGING: c.get('DB_LOGGING'),
        }),
        migrationsRun: c.get('RUN_MIGRATIONS_ON_START') === 'true',
      }),
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
    ContactModule,
    NewsModule,
  ],
  providers: [
    // order matters: rate-limit -> authenticate -> authorize
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
