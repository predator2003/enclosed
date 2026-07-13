import { describe, expect, test } from 'vitest';
import { createMemoryStorage } from '../storage/factories/memory.storage';
import { createNoteNotFoundError } from './notes.errors';
import { createNoteRepository } from './notes.repository';
import { confirmNoteRead, getRefreshedNote } from './notes.usecases';

describe('notes usecases', () => {
  describe('getRefreshedNote', () => {
    test('a note whose expiration date is later than the current date can be retrieved', async () => {
      const { storage } = createMemoryStorage();

      storage.setItem('note-1', {
        content: '<encrypted-content>',
        expirationDate: '2024-01-01T00:01:00.000Z',
        deleteAfterReading: false,
      });

      const { note } = await getRefreshedNote({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
        now: new Date('2024-01-01T00:00:30Z'),
      });

      expect(note).to.eql({
        content: '<encrypted-content>',
        deleteAfterReading: false,
        expirationDate: new Date('2024-01-01T00:01:00.000Z'),
      });
    });

    test('a note whose expiration date is earlier than the current date is considered expired and cannot be retrieved', async () => {
      const { storage } = createMemoryStorage();

      storage.setItem('note-1', {
        content: '<encrypted-content>',
        expirationDate: '2024-01-01T00:01:00.000Z',
        deleteAfterReading: false,
      });

      await expect(
        getRefreshedNote({
          noteId: 'note-1',
          notesRepository: createNoteRepository({ storage }),
          now: new Date('2024-01-02T00:00:00Z'),
        }),
      ).rejects.toThrow(createNoteNotFoundError());
    });

    test('a note whose expiration date is the same as the current date is considered expired and cannot be retrieved', async () => {
      const { storage } = createMemoryStorage();

      storage.setItem('note-1', {
        content: '<encrypted-content>',
        expirationDate: '2024-01-01T00:00:00.000Z',
        deleteAfterReading: false,
      });

      await expect(
        getRefreshedNote({
          noteId: 'note-1',
          notesRepository: createNoteRepository({ storage }),
          now: new Date('2024-01-01T00:00:00Z'),
        }),
      ).rejects.toThrow(createNoteNotFoundError());
    });

    test('a delete-after-reading note is NOT deleted by fetching it, only by confirming the read, so a wrong password attempt or a link-preview prefetch cannot destroy it', async () => {
      const { storage } = createMemoryStorage();

      storage.setItem('note-1', {
        content: '<encrypted-content>',
        expirationDate: '2024-01-02T00:00:00.000Z',
        deleteAfterReading: true,
      });

      await getRefreshedNote({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
        now: new Date('2024-01-01T00:00:30Z'),
      });

      // The note survives a second fetch as long as the read was not confirmed
      const { note } = await getRefreshedNote({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
        now: new Date('2024-01-01T00:01:00Z'),
      });

      expect(note.deleteAfterReading).to.eql(true);
    });
  });

  describe('confirmNoteRead', () => {
    test('confirming the read of a delete-after-reading note deletes the note', async () => {
      const { storage } = createMemoryStorage();

      storage.setItem('note-1', {
        content: '<encrypted-content>',
        expirationDate: '2024-01-02T00:00:00.000Z',
        deleteAfterReading: true,
      });

      const { deleted } = await confirmNoteRead({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
      });

      expect(deleted).to.eql(true);

      await expect(
        getRefreshedNote({
          noteId: 'note-1',
          notesRepository: createNoteRepository({ storage }),
          now: new Date('2024-01-01T00:01:00Z'),
        }),
      ).rejects.toThrow(createNoteNotFoundError());
    });

    test('confirming the read of a regular note does not delete it', async () => {
      const { storage } = createMemoryStorage();

      storage.setItem('note-1', {
        content: '<encrypted-content>',
        expirationDate: '2024-01-02T00:00:00.000Z',
        deleteAfterReading: false,
      });

      const { deleted } = await confirmNoteRead({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
      });

      expect(deleted).to.eql(false);

      const { note } = await getRefreshedNote({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
        now: new Date('2024-01-01T00:01:00Z'),
      });

      expect(note.deleteAfterReading).to.eql(false);
    });

    test('confirming the read of a missing note rejects with a not-found error', async () => {
      const { storage } = createMemoryStorage();

      await expect(
        confirmNoteRead({
          noteId: 'unknown-note',
          notesRepository: createNoteRepository({ storage }),
        }),
      ).rejects.toThrow(createNoteNotFoundError());
    });
  });

  describe('delete-after-reading fallback expiration', () => {
    test('fetching a delete-after-reading note without expiration assigns the fallback TTL so an unconfirmed read cannot keep it alive forever', async () => {
      const { storage } = createMemoryStorage();

      storage.setItem('note-1', {
        content: '<encrypted-content>',
        deleteAfterReading: true,
      });

      await getRefreshedNote({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
        now: new Date('2024-01-01T00:00:00Z'),
      });

      // Still readable within the fallback window
      const { note } = await getRefreshedNote({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
        now: new Date('2024-01-01T12:00:00Z'),
      });

      expect(note.expirationDate).to.eql(new Date('2024-01-02T00:00:00Z'));

      // Expired (and deleted) once the fallback TTL elapsed
      await expect(
        getRefreshedNote({
          noteId: 'note-1',
          notesRepository: createNoteRepository({ storage }),
          now: new Date('2024-01-02T00:00:01Z'),
        }),
      ).rejects.toThrow(createNoteNotFoundError());
    });

    test('a delete-after-reading note that already has an expiration keeps it', async () => {
      const { storage } = createMemoryStorage();

      storage.setItem('note-1', {
        content: '<encrypted-content>',
        expirationDate: '2024-01-01T00:10:00.000Z',
        deleteAfterReading: true,
      });

      const { note } = await getRefreshedNote({
        noteId: 'note-1',
        notesRepository: createNoteRepository({ storage }),
        now: new Date('2024-01-01T00:00:00Z'),
      });

      expect(note.expirationDate).to.eql(new Date('2024-01-01T00:10:00.000Z'));
    });
  });
});
