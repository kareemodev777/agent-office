import { getData, updateSettings } from './persistence.js';

export interface WebhookEvent {
  event: string;
  agent: {
    name: string;
    slug: string | null;
    duration: number;
    tokens: number;
  };
  timestamp: string;
}

function getWebhookUrl(): string | null {
  return process.env.AGENT_OFFICE_WEBHOOK_URL || getData().settings.webhookUrl || null;
}

export function setWebhookUrl(url: string): void {
  updateSettings({ webhookUrl: url });
}

export function getConfiguredWebhookUrl(): string | null {
  return getWebhookUrl();
}

export async function sendWebhook(event: WebhookEvent): Promise<void> {
  const url = getWebhookUrl();
  if (!url) return;

  const { agent } = event;
  const summary = `${agent.name || agent.slug || 'Agent'} ${event.event} (${formatDuration(agent.duration)}, ${formatTokens(agent.tokens)} tokens)`;

  // Detect webhook type from URL and format accordingly
  let body: string;
  if (url.includes('discord.com/api/webhooks')) {
    body = JSON.stringify({ content: summary });
  } else if (url.includes('hooks.slack.com')) {
    body = JSON.stringify({ text: summary });
  } else {
    // Generic format
    body = JSON.stringify(event);
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[Agent Office] Webhook failed:', err);
  }
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
