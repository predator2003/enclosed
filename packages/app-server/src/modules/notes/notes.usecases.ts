import type { NotesRepository } from './notes.types';
import { isNil } from 'lodash-es';
import { ONE_DAY_IN_SECONDS } from './notes.constants';
import { createNoteNotFoundError } from './notes.errors';
import { isNoteExpired } from './notes.models';

export { confirmNoteRead, DELETE_AFTER_READING_FALLBACK_TTL_SECONDS, getRefreshedNote };

// Backstop for readers that fetch a delete-after-reading note but never confirm
// (old clients, plain curl): once fetched, a note without expiration gets one so
// it cannot stay readable forever.
const DELETE_AFTER_READING_FALLBACK_TTL_SECONDS = ONE_DAY_IN_SECONDS;

async function getRefreshedNote({
  noteId,
  notesRepository,
  now = new Date(),
}: {
  noteId: string;
  notesRepository: NotesRepository;
  now?: Date;
}) {
  const { note } = await notesRepository.getNoteById({ noteId });

  if (isNoteExpired({ note, now })) {
    await notesRepository.deleteNoteById({ noteId });

    throw createNoteNotFoundError();
  }

  // Delete-after-reading notes are NOT deleted here: the server cannot know whether
  // the reader was able to decrypt the note (the password is checked client-side),
  // so deleting on fetch would destroy the note on a wrong password attempt or a
  // link-preview prefetch. Deletion happens when the client confirms a successful
  // decryption via confirmNoteRead (https://github.com/CorentinTh/enclosed/issues/307).
  if (note.deleteAfterReading && isNil(note.expirationDate)) {
    await notesRepository.setNoteExpiration({ noteId, ttlInSeconds: DELETE_AFTER_READING_FALLBACK_TTL_SECONDS, now });
  }

  return {
    note,
  };
}

async function confirmNoteRead({
  noteId,
  notesRepository,
}: {
  noteId: string;
  notesRepository: NotesRepository;
}) {
  const { note } = await notesRepository.getNoteById({ noteId });

  // Only delete-after-reading notes can be deleted through this flow; for other
  // notes the confirmation is a no-op so the endpoint cannot be abused to delete
  // notes that are meant to live until their expiration.
  if (!note.deleteAfterReading) {
    return { deleted: false };
  }

  await notesRepository.deleteNoteById({ noteId });

  return { deleted: true };
}
