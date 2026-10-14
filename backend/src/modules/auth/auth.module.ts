import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role, User } from '../../entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    JwtModule.registerAsync({
      global: true, // the global JwtAuthGuard needs JwtService
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: c.get<string>('JWT_EXPIRES_IN', '8h') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
