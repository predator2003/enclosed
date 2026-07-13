import { apiClient } from '../shared/http/http-client';

export { confirmNoteRead, fetchNoteById, fetchNoteExists, storeNote };

async function storeNote({
  payload,
  ttlInSeconds,
  deleteAfterReading,
  encryptionAlgorithm,
  serializationFormat,
  isPublic,
}: {
  payload: string;
  ttlInSeconds?: number;
  deleteAfterReading: boolean;
  encryptionAlgorithm: string;
  serializationFormat: string;
  isPublic?: boolean;
}) {
  const { noteId } = await apiClient<{ noteId: string }>({
    path: '/api/notes',
    method: 'POST',
    body: {
      payload,
      ttlInSeconds,
      deleteAfterReading,
      serializationFormat,
      encryptionAlgorithm,
      isPublic,
    },
  });

  return { noteId };
}

async function fetchNoteById({ noteId }: { noteId: string }) {
  const { note } = await apiClient<{ note: {
    payload: string;
    isPasswordProtected: boolean;
    assets: string[];
    serializationFormat: string;
    encryptionAlgorithm: string;
  }; }>({
    path: `/api/notes/${noteId}`,
    method: 'GET',
  });

  return { note };
}

async function confirmNoteRead({ noteId }: { noteId: string }) {
  const { deleted } = await apiClient<{ deleted: boolean }>({
    path: `/api/notes/${noteId}/read-confirmation`,
    method: 'POST',
    // The reader may close the tab right after the note is displayed; keepalive
    // lets the deletion request complete anyway.
    keepalive: true,
  });

  return { deleted };
}

async function fetchNoteExists({ noteId }: { noteId: string }) {
  const { noteExists } = await apiClient<{ noteExists: boolean }>({
    method: 'GET',
    path: `/api/notes/${noteId}/exists`,
  });

  return { noteExists };
}
