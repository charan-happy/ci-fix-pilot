import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DBService } from '@db/db.service';

// Repositories — centralized data access layer
import { AuthRepository } from './repositories/auth/auth.repository';
import { TokenRepository } from './repositories/auth/token.repository';
import { MfaRepository } from './repositories/auth/mfa.repository';
import { ApiKeyRepository } from './repositories/auth/api-key.repository';
import { OAuthRepository } from './repositories/auth/oauth.repository';
import { UsersRepository } from './repositories/users/users.repository';
import { MediaRepository } from './repositories/media/media.repository';
import { NotificationsRepository } from './repositories/notifications/notifications.repository';
import { AgentsRepository } from './repositories/ai/agents.repository';
import { RagRepository } from './repositories/ai/rag.repository';
import { AuditRepository } from './repositories/common/audit.repository';
import { WebhooksRepository } from './repositories/webhooks/webhooks.repository';
import { CiHealingRepository } from './repositories/ci-healing/ci-healing.repository';

const repositories = [
  AuthRepository,
  TokenRepository,
  MfaRepository,
  ApiKeyRepository,
  OAuthRepository,
  UsersRepository,
  MediaRepository,
  NotificationsRepository,
  AgentsRepository,
  RagRepository,
  AuditRepository,
  WebhooksRepository,
  CiHealingRepository,
];

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DBService, ...repositories],
  exports: [DBService, ...repositories],
})
export class DBModule {}
