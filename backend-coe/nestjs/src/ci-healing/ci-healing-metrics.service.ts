import { Injectable } from '@nestjs/common';
import { Counter, register } from 'prom-client';

@Injectable()
export class CiHealingMetricsService {
  private readonly webhooksCounter: Counter<string>;
  private readonly attemptsCounter: Counter<string>;
  private readonly runStatusCounter: Counter<string>;
  private readonly containerValidationCounter: Counter<string>;
  private readonly prActionsCounter: Counter<string>;
  private readonly humanActionsCounter: Counter<string>;

  constructor() {
    this.webhooksCounter = this.getOrCreateCounter(
      'ci_healing_webhooks_total',
      'Total number of CI healing webhooks received',
      ['provider', 'deduplicated'],
    );

    this.attemptsCounter = this.getOrCreateCounter(
      'ci_healing_attempts_total',
      'Total number of CI healing attempts by status',
      ['status', 'provider'],
    );

    this.runStatusCounter = this.getOrCreateCounter(
      'ci_healing_run_status_transitions_total',
      'Total number of CI healing run status transitions',
      ['status', 'provider'],
    );

    this.containerValidationCounter = this.getOrCreateCounter(
      'ci_healing_container_validation_total',
      'Total number of container validation results before PR creation',
      ['result'],
    );

    this.prActionsCounter = this.getOrCreateCounter(
      'ci_healing_pr_actions_total',
      'Total number of PR actions triggered by CI healing',
      ['action'],
    );

    this.humanActionsCounter = this.getOrCreateCounter(
      'ci_healing_human_actions_total',
      'Total number of human actions on CI healing runs',
      ['action'],
    );
  }

  recordWebhook(provider: string, deduplicated: boolean): void {
    this.webhooksCounter
      .labels(provider || 'unknown', deduplicated ? 'true' : 'false')
      .inc();
  }

  recordAttempt(status: 'succeeded' | 'failed', provider: string): void {
    this.attemptsCounter.labels(status, provider || 'unknown').inc();
  }

  recordRunStatus(status: string, provider: string): void {
    this.runStatusCounter.labels(status, provider || 'unknown').inc();
  }

  recordContainerValidation(success: boolean): void {
    this.containerValidationCounter.labels(success ? 'passed' : 'failed').inc();
  }

  recordPrAction(action: 'opened' | 'merged' | 'closed'): void {
    this.prActionsCounter.labels(action).inc();
  }

  recordHumanAction(action: 'approve' | 'deny' | 'abort' | 'human-fix'): void {
    this.humanActionsCounter.labels(action).inc();
  }

  private getOrCreateCounter(
    name: string,
    help: string,
    labelNames: string[],
  ): Counter<string> {
    const existing = register.getSingleMetric(name);
    if (existing) {
      return existing as Counter<string>;
    }

    return new Counter({
      name,
      help,
      labelNames,
    });
  }
}
