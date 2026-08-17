import { omit } from 'lodash-es';
import { describe, expect, test } from 'vitest';
import { createServer } from '../../app/server';
import { createMemoryStorage } from '../../storage/factories/memory.storage';

describe('e2e', () => {
  describe('create and view note with authentication disabled (public instance)', () => {
    test('a note can be created and viewed', async () => {
      const { storage } = createMemoryStorage();

      const { app } = createServer({
        storageFactory: () => ({ storage }),
      });

      const note = {
        payload: '<encrypted-content>',
        deleteAfterReading: false,
        ttlInSeconds: 600,
        encryptionAlgorithm: 'aes-256-gcm',
        serializationFormat: 'cbor-array',
      };

      const createNoteResponse = await app.request(
        '/api/notes',
        {
          method: 'POST',
          body: JSON.stringify(note),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        },
      );

      expect(createNoteResponse.status).to.eql(200);

      const { noteId } = await createNoteResponse.json<any>();

      expect(noteId).toBeDefined();
      expect(noteId).to.be.a('string');

      const viewNoteResponse = await app.request(`/api/notes/${noteId}`);

      expect(viewNoteResponse.status).to.eql(200);

      const { note: retrievedNote } = await viewNoteResponse.json<any>();

      expect(omit(retrievedNote, 'expirationDate')).to.eql({
        payload: '<encrypted-content>',
        encryptionAlgorithm: 'aes-256-gcm',
        serializationFormat: 'cbor-array',
      });
    });

    test('a delete-after-reading note survives fetches and is only deleted once the read is confirmed', async () => {
      const { storage } = createMemoryStorage();

      const { app } = createServer({
        storageFactory: () => ({ storage }),
      });

      const createNoteResponse = await app.request(
        '/api/notes',
        {
          method: 'POST',
          body: JSON.stringify({
            payload: '<encrypted-content>',
            deleteAfterReading: true,
            ttlInSeconds: 600,
            encryptionAlgorithm: 'aes-256-gcm',
            serializationFormat: 'cbor-array',
          }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        },
      );

      expect(createNoteResponse.status).to.eql(200);

      const { noteId } = await createNoteResponse.json<any>();

      // Fetching does not delete the note: a wrong password attempt or a link
      // prefetch must not destroy it
      const firstFetchResponse = await app.request(`/api/notes/${noteId}`);
      expect(firstFetchResponse.status).to.eql(200);

      const secondFetchResponse = await app.request(`/api/notes/${noteId}`);
      expect(secondFetchResponse.status).to.eql(200);

      // The client confirms the successful decryption, which deletes the note
      const confirmResponse = await app.request(`/api/notes/${noteId}/read-confirmation`, { method: 'POST' });
      expect(confirmResponse.status).to.eql(200);
      expect(await confirmResponse.json()).to.eql({ deleted: true });

      const fetchAfterConfirmResponse = await app.request(`/api/notes/${noteId}`);
      expect(fetchAfterConfirmResponse.status).to.eql(404);
    });

    test('a note can be revoked with the token from the create response, but not with a wrong token', async () => {
      const { storage } = createMemoryStorage();

      const { app } = createServer({
        storageFactory: () => ({ storage }),
      });

      const createNoteResponse = await app.request(
        '/api/notes',
        {
          method: 'POST',
          body: JSON.stringify({
            payload: '<encrypted-content>',
            deleteAfterReading: false,
            ttlInSeconds: 600,
            encryptionAlgorithm: 'aes-256-gcm',
            serializationFormat: 'cbor-array',
          }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        },
      );

      const { noteId, revocationToken } = await createNoteResponse.json<any>();

      expect(revocationToken).to.be.a('string');
      // The stored note must never contain the plain token
      expect(JSON.stringify(await storage.getItem(noteId))).not.to.include(revocationToken);

      const wrongTokenResponse = await app.request(`/api/notes/${noteId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ revocationToken: 'wrong-token' }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });
      expect(wrongTokenResponse.status).to.eql(404);
      expect((await app.request(`/api/notes/${noteId}`)).status).to.eql(200);

      const revokeResponse = await app.request(`/api/notes/${noteId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ revocationToken }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });
      expect(revokeResponse.status).to.eql(200);
      expect(await revokeResponse.json()).to.eql({ revoked: true });

      expect((await app.request(`/api/notes/${noteId}`)).status).to.eql(404);
    });

    test('confirming the read of a note that is not delete-after-reading does not delete it', async () => {
      const { storage } = createMemoryStorage();

      const { app } = createServer({
        storageFactory: () => ({ storage }),
      });

      const createNoteResponse = await app.request(
        '/api/notes',
        {
          method: 'POST',
          body: JSON.stringify({
            payload: '<encrypted-content>',
            deleteAfterReading: false,
            ttlInSeconds: 600,
            encryptionAlgorithm: 'aes-256-gcm',
            serializationFormat: 'cbor-array',
          }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        },
      );

      const { noteId } = await createNoteResponse.json<any>();

      const confirmResponse = await app.request(`/api/notes/${noteId}/read-confirmation`, { method: 'POST' });
      expect(confirmResponse.status).to.eql(200);
      expect(await confirmResponse.json()).to.eql({ deleted: false });

      const fetchResponse = await app.request(`/api/notes/${noteId}`);
      expect(fetchResponse.status).to.eql(200);
    });

    test('an enregistered serialization format results in a bad request', async () => {
      const { storage } = createMemoryStorage();

      const { app } = createServer({
        storageFactory: () => ({ storage }),
      });

      const response = await app.request(
        '/api/notes',
        {
          method: 'POST',
          body: JSON.stringify({
            payload: '<encrypted-content>',
            deleteAfterReading: false,
            ttlInSeconds: 600,
            encryptionAlgorithm: 'aes-256-gcm',
            serializationFormat: 'foo', // <- invalid serialization format
          }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        },
      );

      expect(response.status).to.eql(400);
      expect(await response.json()).to.eql({
        error: {
          code: 'server.invalid_request.body',
          message: 'Invalid request body',
          details: [
            {
              message: 'Invalid enum value. Expected \'cbor-array\', received \'foo\'',
              path: 'serializationFormat',
            },
          ],
        },
      });
    });

    test('a note with an invalid encryption algorithm results in a bad request', async () => {
      const { storage } = createMemoryStorage();

      const { app } = createServer({
        storageFactory: () => ({ storage }),
      });

      const response = await app.request(
        '/api/notes',
        {
          method: 'POST',
          body: JSON.stringify({
            payload: '<encrypted-content>',
            deleteAfterReading: false,
            ttlInSeconds: 600,
            encryptionAlgorithm: 'foo', // <- invalid encryption algorithm
            serializationFormat: 'cbor-array',
          }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        },
      );

      expect(response.status).to.eql(400);
      expect(await response.json()).to.eql({
        error: {
          code: 'server.invalid_request.body',
          message: 'Invalid request body',
          details: [
            {
              message: 'Invalid enum value. Expected \'aes-256-gcm\', received \'foo\'',
              path: 'encryptionAlgorithm',
            },
          ],
        },
      });
    });

    test('on a public instance we cannot create a non-public note', async () => {
      const { storage } = createMemoryStorage();

      const { app } = createServer({
        storageFactory: () => ({ storage }),
      });

      const response = await app.request(
        '/api/notes',
        {
          method: 'POST',
          body: JSON.stringify({
            payload: '<encrypted-content>',
            deleteAfterReading: false,
            ttlInSeconds: 600,
            encryptionAlgorithm: 'aes-256-gcm',
            serializationFormat: 'cbor-array',
            isPublic: false, // <- non-public note
          }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        },
      );

      expect(response.status).to.eql(403);
      expect(await response.json()).to.eql({
        error: {
          code: 'note.cannot_create_private_note_on_public_instance',
          message: 'Cannot create private note on public instance',
        },
      });
    });
  });
});
