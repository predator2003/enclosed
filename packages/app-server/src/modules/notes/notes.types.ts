import type { Expand } from '@corentinth/chisels';
import type { createNoteRepository } from './notes.repository';

export type NotesRepository = ReturnType<typeof createNoteRepository>;

export type DatabaseNote = {
  payload: string;
  encryptionAlgorithm: string;
  serializationFormat: string;
  expirationDate?: string;
  deleteAfterReading: boolean;
  isPublic: boolean;
  // Only the SHA-256 hash of the revocation token is stored; the token itself
  // is returned once at creation time
  revocationTokenHash?: string;

  // compressionAlgorithm: string
  // keyDerivationAlgorithm: string;

};

export type Note = Expand<Omit<DatabaseNote, 'expirationDate'> & { expirationDate?: Date }>;
