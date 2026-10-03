import { randomUUID } from 'node:crypto';
import { eventFingerprint } from './event.js';

export class CalendarService {
  constructor({ store, google, caldav }) { Object.assign(this, { store, google, caldav }); }
  async create({ idempotencyKey, event }) {
    const fingerprint = eventFingerprint(event);
    let record = await this.store.get(idempotencyKey);
    if (record && record.fingerprint !== fingerprint) return { conflict: true };
    if (!record) record = { id: randomUUID(), fingerprint, event, status: 'pending', providers: {}, createdAt: new Date().toISOString() };

    for (const [name, connector] of Object.entries({ google: this.google, caldav: this.caldav })) {
      if (record.providers[name]?.status === 'created') continue;
      try {
        const externalId = name === 'google' ? `agent${record.id.replace(/-/g, '').slice(0, 20)}` : record.id;
        record.providers[name] = { status: 'created', ...(await connector.create(event, externalId)), updatedAt: new Date().toISOString() };
      } catch (error) {
        record.providers[name] = { status: 'failed', error: error.message, updatedAt: new Date().toISOString() };
      }
      await this.store.put(idempotencyKey, record);
    }
    record.status = Object.values(record.providers).every((item) => item.status === 'created') ? 'created' : 'partial_failure';
    await this.store.put(idempotencyKey, record);
    return { record, replay: Boolean(record.createdAt) };
  }
}
