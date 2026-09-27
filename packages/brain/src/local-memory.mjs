import { createHindsightAdapter } from './hindsight-adapter.mjs';
import { createMemoryEngine } from './memory-engine.mjs';
import { createLocalPg0MemoryStore } from './postgres-memory-store.mjs';

export async function createLocalHindsightMemoryEngine({ authorizeRead, authorizePromotion, baseUrl, instanceConfigPath } = {}) {
  if (typeof authorizeRead !== 'function') throw new Error('Local canonical memory requires an explicit ACL read authorizer.');
  const store = await createLocalPg0MemoryStore({ instanceConfigPath, authorizePromotion });
  try {
    const migration = await store.migrate();
    const hindsight = createHindsightAdapter({ baseUrl });
    const engine = createMemoryEngine({ store, hindsight, authorizeRead, authorizePromotion });
    return Object.freeze({ engine, migration, close: () => store.close() });
  } catch {
    await store.close();
    throw new Error('Local canonical Hindsight memory engine initialization failed.');
  }
}
