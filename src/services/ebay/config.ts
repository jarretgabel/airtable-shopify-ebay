/**
 * eBay configuration compatibility wrapper.
 *
 * Split implementation lives in:
 * - configEnv.ts for constants/env/keys
 * - configRuntime.ts for localStorage-backed runtime helpers
 */
export * from './configEnv';
export * from './configRuntime';
