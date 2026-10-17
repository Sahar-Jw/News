import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { FileStorageService } from './file-storage.service';
import { FilesController } from './files.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [FilesController],
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class FilesModule {}
