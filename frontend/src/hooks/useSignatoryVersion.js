import { useSyncExternalStore } from 'react';
import { signatoryVersion, subscribeSignatory } from '../services/documentSignatory';

// A number that changes whenever the document signatory is switched, added or removed
// (account menu → Document signatory). Put it in an effect's dependencies to redraw an open preview.
export default function useSignatoryVersion() {
  return useSyncExternalStore(subscribeSignatory, signatoryVersion);
}
