import { apiClient } from '../api/api.client';

export { confirmNoteRead, fetchNote, storeNote };

async function storeNote({
  payload,
  ttlInSeconds,
  deleteAfterReading,
  apiBaseUrl,
  serializationFormat,
  encryptionAlgorithm,
  isPublic,
}: {
  payload: string;
  ttlInSeconds?: number;
  deleteAfterReading: boolean;
  apiBaseUrl?: string;
  serializationFormat: string;
  encryptionAlgorithm: string;
  isPublic?: boolean;
}): Promise<{ noteId: string }> {
  const { noteId } = await apiClient<{ noteId: string }>({
    path: 'api/notes',
    baseUrl: apiBaseUrl,
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

async function confirmNoteRead({
  noteId,
  apiBaseUrl,
}: {
  noteId: string;
  apiBaseUrl?: string;
}): Promise<{ deleted: boolean }> {
  // Tells the server the note was successfully decrypted; delete-after-reading
  // notes are only deleted once this confirmation is received.
  const { deleted } = await apiClient<{ deleted: boolean }>({
    path: `api/notes/${noteId}/read-confirmation`,
    baseUrl: apiBaseUrl,
    method: 'POST',
  });

  return { deleted };
}

async function fetchNote({
  noteId,
  apiBaseUrl,
}: {
  noteId: string;
  apiBaseUrl?: string;
}) {
  const { note } = await apiClient<{ note: {
    payload: string;
  }; }>({
    path: `api/notes/${noteId}`,
    baseUrl: apiBaseUrl,
    method: 'GET',
  });

  return note;
}
