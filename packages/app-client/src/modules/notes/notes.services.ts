import { authStore } from '../auth/auth.store';
import { getConfig } from '../config/config.provider';
import { apiClient } from '../shared/http/http-client';
import { buildUrl } from '../shared/http/http-client.models';

export { confirmNoteRead, fetchNoteById, fetchNoteExists, storeNote };

// The note payload is sent via XHR instead of fetch because fetch cannot report
// upload progress (upstream issue #437). Error objects carry the same
// { status, body } shape as apiClient so the shared http-error helpers work.
async function storeNote({
  payload,
  ttlInSeconds,
  deleteAfterReading,
  encryptionAlgorithm,
  serializationFormat,
  isPublic,
  onUploadProgress,
}: {
  payload: string;
  ttlInSeconds?: number;
  deleteAfterReading: boolean;
  encryptionAlgorithm: string;
  serializationFormat: string;
  isPublic?: boolean;
  onUploadProgress?: (args: { percent: number }) => void;
}) {
  const config = getConfig();
  const url = buildUrl({ path: '/api/notes', baseUrl: config.baseApiUrl });
  const accessToken = authStore.getAccessToken();

  const { noteId } = await new Promise<{ noteId: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');

    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onUploadProgress?.({ percent: Math.round((event.loaded / event.total) * 100) });
      }
    };

    xhr.onload = () => {
      const parseResponse = () => {
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return undefined;
        }
      };

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parseResponse());
        return;
      }

      const error = new Error(xhr.statusText || `Request failed with status ${xhr.status}`);
      Object.assign(error, { status: xhr.status, body: parseResponse() });
      reject(error);
    };

    xhr.onerror = () => reject(new Error('Network error while storing the note'));

    xhr.send(JSON.stringify({
      payload,
      ttlInSeconds,
      deleteAfterReading,
      serializationFormat,
      encryptionAlgorithm,
      isPublic,
    }));
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
