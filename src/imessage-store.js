import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JsonStateStore {
  constructor(path, initialState) { this.path = path; this.initialState = initialState; }
  async load() {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return structuredClone(this.initialState); throw error; }
  }
  async save(state) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(temporary, this.path);
  }
}

export const messageState = () => ({ processedMessageIds: [], recentCommandKeys: [], recentResponseKeys: [], pendingProposal: null, outbound: [] });
