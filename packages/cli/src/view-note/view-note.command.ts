import { confirmNoteRead, decryptNote, fetchNote, isApiClientErrorWithStatusCode, parseNoteUrl } from '@enclosed/lib';
import { defineCommand } from 'citty';
import picocolors from 'picocolors';
import { getInstanceUrl } from '../config/config.usecases';
import { promptForPassword } from './view-note.models';

export const viewNoteCommand = defineCommand({
  meta: {
    name: 'view',
    description: 'View a note',
  },
  args: {
    noteUrl: {
      description: 'Note URL',
      type: 'positional',
      required: true,
    },
    password: {
      description: 'Password to decrypt the note (will be prompted if needed and not provided)',
      valueHint: 'password',
      alias: 'p',
      type: 'string',
      required: false,
    },
  },
  run: async ({ args }) => {
    const { noteUrl, password } = args;

    try {
      const { noteId, encryptionKey, isPasswordProtected, isDeletedAfterReading } = parseNoteUrl({ noteUrl });

      const { payload } = await fetchNote({
        noteId,
        apiBaseUrl: getInstanceUrl(),
      });

      const { note } = await decryptNote({
        encryptedPayload: payload,
        encryptionKey,
        password: isPasswordProtected ? password ?? await promptForPassword() : undefined,
      });

      if (isDeletedAfterReading) {
        // Delete-after-reading notes are only deleted server-side once decryption
        // succeeded. The content is already available at this point, so a failed
        // confirmation must not fail the command.
        await confirmNoteRead({ noteId, apiBaseUrl: getInstanceUrl() }).catch(() => {});
      }

      console.log(note.content);
    } catch (error) {
      if (isApiClientErrorWithStatusCode({ error, statusCode: 404 })) {
        console.error(picocolors.red('Note not found'));
        return;
      }

      if (isApiClientErrorWithStatusCode({ error, statusCode: 429 })) {
        console.error(picocolors.red('Api rate limit reached, please try again later'));
        return;
      }

      console.error(picocolors.red('Failed to fetch or decrypt note'));
    }
  },
});
