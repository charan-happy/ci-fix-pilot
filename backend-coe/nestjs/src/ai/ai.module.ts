import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClaudeAiProvider } from './providers/claude.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { AiService } from './ai.service';

@Module({
  imports: [ConfigModule],
  providers: [ClaudeAiProvider, OpenAiProvider, AiService],
  exports: [AiService, ClaudeAiProvider, OpenAiProvider],
})
export class AiModule {}
