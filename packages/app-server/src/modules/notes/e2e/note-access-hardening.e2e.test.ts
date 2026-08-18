import type { ServerInstance } from '../../app/server.types';
import { describe, expect, test } from 'vitest';
import { overrideConfig } from '../../app/config/config.test-utils';
import { createServer } from '../../app/server';
import { createMemoryStorage } from '../../storage/factories/memory.storage';

const AUTHENTICATED_HEADERS = new Headers({
  'Content-Type': 'application/json',
  // valid token for key 'secret-key'
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.sSmY3kpYwtAY4wEJLXCWZVKZCYRW5cH4UGkw9RMEBrk',
});

const privateInstanceConfig = overrideConfig({
  public: { isAuthenticationRequired: true },
  authentication: { jwtSecret: 'secret-key' },
});

async function createPrivateNote({ app }: { app: ServerInstance }) {
  const response = await app.request('/api/notes', {
    method: 'POST',
    body: JSON.stringify({
      payload: '<encrypted-content>',
      deleteAfterReading: false,
      ttlInSeconds: 600,
      encryptionAlgorithm: 'aes-256-gcm',
      serializationFormat: 'cbor-array',
      isPublic: false,
    }),
    headers: AUTHENTICATED_HEADERS,
  });

  const { noteId } = await response.json<any>();

  return { noteId };
}

describe('e2e', () => {
  describe('note access hardening on an instance that requires authentication', () => {
    test('the exists route does not answer the existence question the get route refuses to answer', async () => {
      const { storage } = createMemoryStorage();
      const { app } = createServer({ storageFactory: () => ({ storage }), config: privateInstanceConfig });

      const { noteId } = await createPrivateNote({ app });

      const existingNoteResponse = await app.request(`/api/notes/${noteId}/exists`);
      const missingNoteResponse = await app.request('/api/notes/01hy0000000000000000000000/exists');

      // An unauthenticated caller must not be able to tell an existing private
      // note apart from one that never existed
      expect(existingNoteResponse.status).to.eql(401);
      expect(missingNoteResponse.status).to.eql(401);
      expect(await existingNoteResponse.json()).to.eql(await missingNoteResponse.json());

      // ... while an authenticated caller still gets the answer
      const authenticatedResponse = await app.request(`/api/notes/${noteId}/exists`, { headers: AUTHENTICATED_HEADERS });

      expect(authenticatedResponse.status).to.eql(200);
      expect(await authenticatedResponse.json()).to.eql({ noteExists: true });
    });

    test('the get route answers identically for a missing and an existing private note', async () => {
      const { storage } = createMemoryStorage();
      const { app } = createServer({ storageFactory: () => ({ storage }), config: privateInstanceConfig });

      const { noteId } = await createPrivateNote({ app });

      const existingNoteResponse = await app.request(`/api/notes/${noteId}`);
      const missingNoteResponse = await app.request('/api/notes/01hy0000000000000000000000');

      expect(existingNoteResponse.status).to.eql(401);
      expect(missingNoteResponse.status).to.eql(401);
      expect(await existingNoteResponse.json()).to.eql(await missingNoteResponse.json());
    });
  });

  describe('request body limits', () => {
    test('a body that announces an oversized length is rejected before it is read', async () => {
      const { storage } = createMemoryStorage();
      const config = overrideConfig({ notes: { maxEncryptedPayloadLength: 1024 } });
      const { app } = createServer({ storageFactory: () => ({ storage }), config });

      const response = await app.request('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          payload: 'a'.repeat(8 * 1024),
          deleteAfterReading: false,
          ttlInSeconds: 600,
          encryptionAlgorithm: 'aes-256-gcm',
          serializationFormat: 'cbor-array',
        }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });

      expect(response.status).to.eql(413);
    });

    test('a body without a content length gets a small allowance, since it can only be measured by buffering it', async () => {
      const { storage } = createMemoryStorage();
      // A generous payload limit must not translate into a generous amount of
      // memory that an unauthenticated client can make the server buffer
      const config = overrideConfig({ notes: { maxEncryptedPayloadLength: 1024 * 1024 * 50 } });
      const { app } = createServer({ storageFactory: () => ({ storage }), config });

      const oversizedChunk = new TextEncoder().encode('a'.repeat(1024 * 1024));

      const response = await app.request('/api/notes', {
        method: 'POST',
        // A stream body has no content-length, so hono has to buffer to know the size
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(oversizedChunk);
            controller.close();
          },
        }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
        duplex: 'half',
      } as RequestInit);

      expect(response.status).to.eql(413);
    });
  });
});
