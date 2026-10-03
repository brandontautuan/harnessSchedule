import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function parseJsonLines(text) {
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export class IMessageClient {
  constructor({ executable = 'imsg', exec = execFileAsync, spawnProcess = spawn } = {}) { Object.assign(this, { executable, exec, spawnProcess }); }
  async findExactText(text) {
    try {
      const { stdout } = await this.exec(this.executable, ['search', '--query', text, '--match', 'exact', '--limit', '20', '--json'], { maxBuffer: 1024 * 1024 });
      return parseJsonLines(stdout);
    } catch { throw new Error('Could not search local Messages history. Confirm Full Disk Access is enabled for VS Code and retry.'); }
  }
  async sendText(chatGuid, text) {
    try { await this.exec(this.executable, ['send', '--chat-guid', chatGuid, '--service', 'imessage', '--no-sms-fallback', '--text', text, '--json'], { maxBuffer: 1024 * 1024 }); }
    catch { throw new Error('Messages.app did not accept the outgoing reply. Grant VS Code Automation permission for Messages, then retry.'); }
  }
  watch(chatId, startIso, onMessage, onError) {
    const child = this.spawnProcess(this.executable, ['watch', '--chat-id', String(chatId), '--start', startIso, '--json', '--debounce', '250ms'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buffered = '';
    child.stdout.on('data', (chunk) => {
      buffered += chunk;
      const lines = buffered.split(/\r?\n/); buffered = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try { onMessage(JSON.parse(line)); } catch { onError(new Error('Received an unreadable Messages event; it was ignored.')); }
      }
    });
    child.on('error', () => onError(new Error('Could not start imsg. Confirm it is installed and on PATH.')));
    child.stderr.on('data', () => onError(new Error('imsg reported a local watch error. Check Full Disk Access and restart the watcher.')));
    return child;
  }
}
