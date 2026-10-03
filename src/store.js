import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class EventStore {
  constructor(path) { this.path = path; }
  async load() {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { events: {} }; throw error; }
  }
  async get(key) { return (await this.load()).events[key]; }
  async put(key, value) {
    const db = await this.load();
    db.events[key] = value;
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.tmp`;
    await writeFile(tempPath, JSON.stringify(db, null, 2), { mode: 0o600 });
    await rename(tempPath, this.path);
  }
}
