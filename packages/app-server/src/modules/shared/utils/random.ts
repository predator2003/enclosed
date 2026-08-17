import { ulidFactory } from 'ulid-workers';

export { generateId };

// Note ids are capability identifiers: in monotonic mode, ids created within the same
// millisecond are a deterministic +1 of the previous random suffix, making burst-created
// ids partly predictable. Sortability is not needed here, so keep the full 80 bits of
// randomness per id.
const createUlid = ulidFactory({ monotonic: false });

function generateId() {
  return createUlid().toLowerCase();
}
