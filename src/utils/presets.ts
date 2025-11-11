export const ENV_PRESETS_KEY = 'dev-settings-environment-presets';
export const BOAT_PRESETS_KEY = 'dev-settings-boat-presets';
export const ACTIVE_ENV_PRESET_KEY = 'dev-settings-active-environment-id';
export const ACTIVE_BOAT_PRESET_KEY = 'dev-settings-active-boat-id';

export function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
