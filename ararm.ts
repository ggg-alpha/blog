import 'dotenv/config';
import { readdir, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PATCHNOTES_DIR = 'docs/patchnotes';
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

function looksLikeDiscordWebhook(url?: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      u.hostname === 'discord.com' && u.pathname.startsWith('/api/webhooks/') ||
      u.hostname === 'discordapp.com' && u.pathname.startsWith('/api/webhooks/') ||
      u.hostname.endsWith('discord.com') && u.pathname.includes('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

async function findNewPatchnotes(): Promise<string[]> {
  try {
    const files = await readdir(PATCHNOTES_DIR);
    return files.filter(file => file.endsWith('.md'));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Failed to read patchnotes directory:', error);
    return [];
  }
}

async function sendToDiscord(content: string): Promise<void> {
  try {
    console.log('Sending to Discord:', content);
    const response = await fetch(WEBHOOK_URL as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
    console.log('Discord response status:', response.status);
    if (!response.ok) {
      if (response.status === 405) {
        throw new Error(
          'Discord API responded with 405 Method Not Allowed. This usually means the webhook URL is invalid or does not accept POST. ' +
            'Check that DISCORD_WEBHOOK_URL points to a Discord webhook (example: https://discord.com/api/webhooks/<id>/<token>)'
        );
      }
      throw new Error(`Discord API responded with ${response.status}`);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Failed to send to Discord:', error);
    // Rethrow so caller can decide how to handle failures
    throw error;
  }
}

async function main() {
  if (!WEBHOOK_URL) {
    console.error('DISCORD_WEBHOOK_URL is not set');
    process.exit(1);
  }

  if (!looksLikeDiscordWebhook(WEBHOOK_URL)) {
    console.error('DISCORD_WEBHOOK_URL does not look like a Discord webhook URL:', WEBHOOK_URL);
    console.error('Please set DISCORD_WEBHOOK_URL to a valid webhook, for example: https://discord.com/api/webhooks/<id>/<token>');
    process.exit(1);
  }

  const patchnotes = await findNewPatchnotes();
  
  for (const file of patchnotes) {
    const content = await readFile(join(PATCHNOTES_DIR, file), 'utf-8');
    await sendToDiscord(`**New Patchnote**: ${file}\n\n${content}`);
  }
}

main().catch(console.error);