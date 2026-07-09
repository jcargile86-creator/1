/**
 * Client sync layer (Supabase). Offline-first: AsyncStorage stays the local
 * cache and source of truth for the field UX; this layer mirrors writes up and
 * reconciles reads down when configured + authenticated. With no config it is
 * entirely inert and the app behaves exactly as the local-only build.
 *
 * Wiring plan (next step, once the project is provisioned and keys are set):
 *  1. AuthStore: when isSyncConfigured(), route sign-in/up through
 *     signInRemote/signUpRemote and use the returned userId as the account id.
 *  2. InspectionStore: after each local write, fire-and-forget pushClaim();
 *     on load (and on regaining connectivity) pullClaims() and reconcile with
 *     mergeByUpdatedAt() before setting state.
 *  3. deleteInspection -> deleteClaim().
 * All guarded by isSyncConfigured() so unconfigured builds are untouched.
 */
export { isSyncConfigured, getSyncConfig } from './config';
export { getSupabase } from './client';
export { pushClaim, pullClaims, deleteClaim } from './claims';
export { signInRemote, signUpRemote, signOutRemote, getRemoteUserId } from './auth';
export { inspectionToRow, rowToInspection } from './mapping';
export { mergeByUpdatedAt } from './merge';
