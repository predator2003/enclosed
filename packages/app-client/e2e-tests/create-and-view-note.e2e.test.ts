import { expect, test } from '@playwright/test';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('Can create and view a note', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('WEIN & CO Notes – Vertrauliche Notizen sicher teilen');

  // Write a note with a password and delete after reading
  await page.getByTestId('note-content').fill('Hello, World!');
  await page.getByTestId('note-password').fill('my-cat-is-cute');
  await page.getByTestId('delete-after-reading').click();

  await page.getByTestId('create-note').click();
  await sleep(1000);

  const noteUrl = await page.getByTestId('note-url').inputValue();

  expect(noteUrl).toBeDefined();

  await page.goto(noteUrl);

  await page.getByTestId('note-deletion-accept').click();
  await page.getByTestId('note-password-prompt').fill('my-cat-is-cute');

  // A delete-after-reading note is only deleted once the client confirms that it
  // could actually decrypt it, so wait for that confirmation rather than for the
  // fetch that merely delivered the ciphertext.
  const readConfirmation = page.waitForResponse(response => response.url().includes('/read-confirmation'));

  await page.getByTestId('note-password-submit').click();

  const noteContent = await page.getByTestId('note-content-display').textContent();

  expect(noteContent).toBe('Hello, World!');

  await readConfirmation;

  // Refresh the page and check if the note is still there
  await page.reload();

  await expect(page.getByText('Note not found')).toBeVisible();
});

test('A wrong password does not destroy a delete-after-reading note', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('note-content').fill('Hello, World!');
  await page.getByTestId('note-password').fill('my-cat-is-cute');
  await page.getByTestId('delete-after-reading').click();

  await page.getByTestId('create-note').click();
  await sleep(1000);

  const noteUrl = await page.getByTestId('note-url').inputValue();

  // A reader who cannot decrypt the note must not consume it
  await page.goto(noteUrl);
  await page.getByTestId('note-deletion-accept').click();
  await page.getByTestId('note-password-prompt').fill('wrong-password');
  await page.getByTestId('note-password-submit').click();

  await expect(page.getByText('The password you entered is invalid or the note URL is incorrect.')).toBeVisible();

  // ... so the intended recipient can still read it
  await page.reload();
  await page.getByTestId('note-deletion-accept').click();
  await page.getByTestId('note-password-prompt').fill('my-cat-is-cute');
  await page.getByTestId('note-password-submit').click();

  expect(await page.getByTestId('note-content-display').textContent()).toBe('Hello, World!');
});
