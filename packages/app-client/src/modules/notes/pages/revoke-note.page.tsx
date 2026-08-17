import { useI18n } from '@/modules/i18n/i18n.provider';
import { isHttpErrorWithStatusCode } from '@/modules/shared/http/http-errors';
import { Button } from '@/modules/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/modules/ui/components/card';
import { safely } from '@corentinth/chisels';
import { useLocation, useParams } from '@solidjs/router';
import { type Component, createSignal, Match, Switch } from 'solid-js';
import { revokeNote } from '../notes.services';

export const RevokeNotePage: Component = () => {
  const params = useParams();
  const location = useLocation();
  const { t } = useI18n();

  const [getStatus, setStatus] = createSignal<'idle' | 'revoking' | 'success' | 'not-found'>('idle');

  // The token travels in the hash fragment so it never reaches server or proxy logs
  const getRevocationToken = () => location.hash.slice(1);

  const revoke = async () => {
    setStatus('revoking');

    const [, error] = await safely(revokeNote({ noteId: params.noteId, revocationToken: getRevocationToken() }));

    if (!error) {
      setStatus('success');
      return;
    }

    // The server answers 404 for a missing note AND for a wrong token
    if (isHttpErrorWithStatusCode({ error, statusCode: 404 }) || isHttpErrorWithStatusCode({ error, statusCode: 400 })) {
      setStatus('not-found');
      return;
    }

    setStatus('not-found');
    console.error(error);
  };

  return (
    <div class="sm:mt-6 p-6">
      <Card class="w-full max-w-md mx-auto">
        <Switch>
          <Match when={getStatus() === 'success'}>
            <CardHeader class="text-center">
              <div class="i-tabler-circle-check text-primary text-4xl mx-auto"></div>
              <CardTitle class="text-base font-semibold">
                {t('revoke.success.title')}
              </CardTitle>
              <CardDescription>
                {t('revoke.success.description')}
              </CardDescription>
            </CardHeader>
          </Match>

          <Match when={getStatus() === 'not-found'}>
            <CardHeader class="text-center">
              <div class="i-tabler-alert-triangle text-muted-foreground text-4xl mx-auto"></div>
              <CardTitle class="text-base font-semibold">
                {t('revoke.not-found.title')}
              </CardTitle>
              <CardDescription>
                {t('revoke.not-found.description')}
              </CardDescription>
            </CardHeader>
          </Match>

          <Match when={true}>
            <CardHeader>
              <CardTitle class="text-base font-semibold">
                {t('revoke.title')}
              </CardTitle>
              <CardDescription>
                {t('revoke.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                class="w-full"
                onClick={revoke}
                disabled={getStatus() === 'revoking' || !getRevocationToken()}
                data-test-id="revoke-note"
              >
                <div class="i-tabler-trash mr-2 text-lg"></div>
                {t('revoke.button')}
              </Button>
            </CardContent>
          </Match>
        </Switch>
      </Card>
    </div>
  );
};
