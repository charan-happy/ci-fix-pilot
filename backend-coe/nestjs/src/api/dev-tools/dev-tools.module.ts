import { Module } from '@nestjs/common';
import { DevToolsController } from './dev-tools.controller';

@Module({
  imports: [],
  controllers: [DevToolsController],
  providers: [],
})
export class DevToolsModule {}
