// Minimal Upstash Redis REST state store. It uses one JSON record per Discord
// conversation and is suitable for stateless/serverless request handlers.
export class RedisStateStore {
  constructor({ url, token, key, initialState, fetchImpl = fetch }) { Object.assign(this, { url: url?.replace(/\/$/, ''), token, key, initialState, fetch: fetchImpl }); }
  async load() {
    const result = await this.command('get', this.key);
    if (result === null) return structuredClone(this.initialState);
    try { return JSON.parse(result); }
    catch { throw new Error('Stored Discord conversation state is invalid.'); }
  }
  async save(state) { await this.command('set', this.key, JSON.stringify(state)); }
  async command(command, ...args) {
    if (!this.url || !this.token) throw new Error('Discord state storage is not configured.');
    const response = await this.fetch(`${this.url}/${command}/${args.map(encodeURIComponent).join('/')}`, { headers: { authorization: `Bearer ${this.token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) throw new Error('Discord state storage request failed.');
    return body.result;
  }
}
