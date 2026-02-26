import { EnvConfig } from '@config/env.config';
import { Module } from '@nestjs/common';
import { ConfigModule, registerAs } from '@nestjs/config';
import * as Joi from 'joi';

const envConfig = registerAs(
  'env',
  () =>
    ({
      PORT: parseInt(process.env['PORT'] || '3000', 10),
      NODE_ENV: process.env['NODE_ENV'] || 'development',
      CORS_ORIGINS: process.env['CORS_ORIGINS'] || '*',
      PROMETHEUS_PORT: parseInt(process.env['PROMETHEUS_PORT'] || '9090', 10),
      PROMETHEUS_PUSH_GATEWAY_PORT: parseInt(
        process.env['PROMETHEUS_PUSH_GATEWAY_PORT'] || '9091',
        10
      ),
      PROMTAIL_PORT: parseInt(process.env['PROMTAIL_PORT'] || '9080', 10),
      NODE_EXPORTER_PORT: parseInt(process.env['NODE_EXPORTER_PORT'] || '9100', 10),
      NODE_EXPORTER_TARGET: process.env['NODE_EXPORTER_TARGET'] || '',
      NESTJS_METRICS_TARGET: process.env['NESTJS_METRICS_TARGET'] || '',
      GRAFANA_PORT: parseInt(process.env['GRAFANA_PORT'] || '3001', 10),
      GRAFANA_ADMIN_PASSWORD: process.env['GRAFANA_ADMIN_PASSWORD'] || '',
      LOKI_PORT: parseInt(process.env['LOKI_PORT'] || '3100', 10),
      LOKI_API_TOKEN: process.env['LOKI_API_TOKEN'] || '',
      OTLP_PORT: parseInt(process.env['OTLP_PORT'] || '4317', 10),
      OTEL_SERVICE_NAME: process.env['OTEL_SERVICE_NAME'] || '',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || '',
      JAEGER_PORT: parseInt(process.env['JAEGER_PORT'] || '16686', 10),
      JAEGER_COLLECTOR_PORT: parseInt(process.env['JAEGER_COLLECTOR_PORT'] || '14268', 10),
      JAGER_URL: process.env['JAGER_URL'] || '',
      REDIS_HOST: process.env['REDIS_HOST'] || '',
      REDIS_PORT: parseInt(process.env['REDIS_PORT'] || '6379', 10),
      REDIS_PASSWORD: process.env['REDIS_PASSWORD'] || '',
      REDIS_TLS_ENABLED: (process.env['REDIS_TLS_ENABLED'] || 'false').toLowerCase() === 'true',
      POSTGRES_DB: process.env['POSTGRES_DB'] || 'postgres',
      POSTGRES_USER: process.env['POSTGRES_USER'] || 'postgres',
      POSTGRES_PASSWORD: process.env['POSTGRES_PASSWORD'] || 'postgres',
      POSTGRES_HOST: process.env['POSTGRES_HOST'] || '127.0.0.1',
      POSTGRES_PORT: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
      DATABASE_URL: (() => {
        const dbUrl = process.env['DATABASE_URL'];
        // If DATABASE_URL contains template variables, construct it from individual components
        if (dbUrl && dbUrl.includes('${')) {
          return `postgresql://${process.env['POSTGRES_USER'] || 'postgres'}:${process.env['POSTGRES_PASSWORD'] || 'postgres'}@${process.env['POSTGRES_HOST'] || '127.0.0.1'}:${process.env['POSTGRES_PORT'] || '5432'}/${process.env['POSTGRES_DB'] || 'postgres'}`;
        }
        return (
          dbUrl ||
          `postgresql://${process.env['POSTGRES_USER'] || 'postgres'}:${process.env['POSTGRES_PASSWORD'] || 'postgres'}@${process.env['POSTGRES_HOST'] || '127.0.0.1'}:${process.env['POSTGRES_PORT'] || '5432'}/${process.env['POSTGRES_DB'] || 'postgres'}`
        );
      })(),
      DEFAULT_PAGE: parseInt(process.env['DEFAULT_PAGE'] || '1', 10),
      DEFAULT_PAGE_SIZE: parseInt(process.env['DEFAULT_PAGE_SIZE'] || '10', 10),
      GRAFANA_URL: process.env['GRAFANA_URL'] || '',
      APP_LOGS_URL: process.env['APP_LOGS_URL'] || '',
      DEV_DOCS_URL: process.env['DEV_DOCS_URL'] || '',
      SERVICES_HEALTH_URL: process.env['SERVICES_HEALTH_URL'] || '',
      CI_HEALING_ENABLED: process.env['CI_HEALING_ENABLED'] || 'true',
      CI_HEALING_MAX_ATTEMPTS: process.env['CI_HEALING_MAX_ATTEMPTS'] || '3',
      CI_HEALING_SAFE_MODE: process.env['CI_HEALING_SAFE_MODE'] || 'true',
      CI_HEALING_LANGGRAPH_ENABLED: process.env['CI_HEALING_LANGGRAPH_ENABLED'] || 'true',
      CI_HEALING_WEBHOOK_SECRET: process.env['CI_HEALING_WEBHOOK_SECRET'] || '',
      CI_HEALING_SLACK_WEBHOOK_URL: process.env['CI_HEALING_SLACK_WEBHOOK_URL'] || '',
      CI_HEALING_AI_PROVIDER: process.env['CI_HEALING_AI_PROVIDER'] || 'anthropic',
      CI_HEALING_GITHUB_ENABLED: process.env['CI_HEALING_GITHUB_ENABLED'] || 'false',
      GITHUB_TOKEN: process.env['GITHUB_TOKEN'] || '',
      GITHUB_BASE_BRANCH: process.env['GITHUB_BASE_BRANCH'] || 'main',
      CLAUDE_DEFAULT_MODEL: process.env['CLAUDE_DEFAULT_MODEL'] || 'claude-sonnet-4-20250514',
      GEMINI_DEFAULT_MODEL: process.env['GEMINI_DEFAULT_MODEL'] || 'gemini-2.5-pro',
      GROK_DEFAULT_MODEL: process.env['GROK_DEFAULT_MODEL'] || 'grok-3',
    }) as EnvConfig
);

const validationSchema = Joi.object({
  PORT: Joi.number().port().required(),
  NODE_ENV: Joi.string().valid('development', 'production').required(),
  CORS_ORIGINS: Joi.string().required().disallow(null, ''),
  PROMETHEUS_PORT: Joi.number().port().allow(null, 9090),
  PROMETHEUS_PUSH_GATEWAY_PORT: Joi.number().port().allow(null, 9091),
  PROMTAIL_PORT: Joi.number().port().allow(null, 9080),
  NODE_EXPORTER_PORT: Joi.number().port().allow(null, 9100),
  NODE_EXPORTER_TARGET: Joi.string().allow(null, '127.0.0.1:3000'),
  NESTJS_METRICS_TARGET: Joi.string().allow(null, 'node-exporter:9100'),
  GRAFANA_PORT: Joi.number().port().allow(null),
  GRAFANA_ADMIN_PASSWORD: Joi.string().allow(null, ''),
  LOKI_PORT: Joi.when('NODE_ENV', {
    is: 'development',
    then: Joi.number().port().required(),
    otherwise: Joi.number().port().allow(null),
  }),
  LOKI_API_TOKEN: Joi.when('NODE_ENV', {
    is: 'development',
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ''),
  }),
  OTLP_PORT: Joi.number().port().allow(null, 4318),
  OTEL_SERVICE_NAME: Joi.string().required(),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().required(),
  JAEGER_PORT: Joi.number().port().allow(null, 16686),
  JAEGER_COLLECTOR_PORT: Joi.number().port().allow(null, 14268),
  JAGER_URL: Joi.string().uri().allow(null, 'http://localhost:16686'),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
  REDIS_PASSWORD: Joi.string().required(),
  REDIS_TLS_ENABLED: Joi.boolean().default(false),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().port().required(),
  // Regex validation for PostgreSQL connection string
  DATABASE_URL: Joi.string()
    .required()
    .pattern(/^postgresql:\/\//)
    .messages({
      'string.pattern.base': 'DATABASE_URL must start with "postgresql://"',
      'string.empty': 'DATABASE_URL is required',
    }),
  DEFAULT_PAGE: Joi.number().default(1),
  DEFAULT_PAGE_SIZE: Joi.number().default(10),
  GRAFANA_URL: Joi.string().required(),
  APP_LOGS_URL: Joi.string().required(),
  DEV_DOCS_URL: Joi.string().required(),
  SERVICES_HEALTH_URL: Joi.string().required(),
  CI_HEALING_ENABLED: Joi.string().valid('true', 'false').default('true'),
  CI_HEALING_MAX_ATTEMPTS: Joi.string().default('3'),
  CI_HEALING_SAFE_MODE: Joi.string().valid('true', 'false').default('true'),
  CI_HEALING_LANGGRAPH_ENABLED: Joi.string().valid('true', 'false').default('true'),
  CI_HEALING_WEBHOOK_SECRET: Joi.string().allow(''),
  CI_HEALING_SLACK_WEBHOOK_URL: Joi.string().allow(''),
  CI_HEALING_AI_PROVIDER: Joi.string().valid('anthropic', 'openai', 'gemini', 'grok').default('anthropic'),
  CI_HEALING_GITHUB_ENABLED: Joi.string().valid('true', 'false').default('false'),
  GITHUB_TOKEN: Joi.string().allow(''),
  GITHUB_BASE_BRANCH: Joi.string().default('main'),
  CLAUDE_DEFAULT_MODEL: Joi.string().default('claude-sonnet-4-20250514'),
  GEMINI_DEFAULT_MODEL: Joi.string().default('gemini-2.5-pro'),
  GROK_DEFAULT_MODEL: Joi.string().default('grok-3'),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      validationSchema,
    }),
  ],
  exports: [ConfigModule],
})
export class EnvConfigModule {}
