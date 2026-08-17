import { createNote, filesToNoteAssets } from '@enclosed/lib';
import { storeNote } from './notes.services';

export { encryptAndCreateNote };

async function encryptAndCreateNote({ onUploadProgress, ...args }: {
  content: string;
  password?: string;
  ttlInSeconds?: number;
  deleteAfterReading: boolean;
  fileAssets: File[];
  isPublic?: boolean;
  pathPrefix?: string;
  onUploadProgress?: (args: { percent: number }) => void;
}) {
  return createNote({
    ...args,
    storeNote: params => storeNote({ ...params, onUploadProgress }),
    clientBaseUrl: window.location.origin,
    assets: [
      ...await filesToNoteAssets({ files: args.fileAssets }),
    ],
  });
}
