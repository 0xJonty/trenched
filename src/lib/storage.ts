/**
 * Typed wrapper over chrome.storage.local.
 *
 * `local` rather than `sync`: sync caps items at 8KB, and both the recon store
 * and the dev wallet list will exceed that.
 */
import { emptyStore, type ReconStore } from './recon.ts'

export interface StorageShape {
  recon: ReconStore
}

const DEFAULTS: StorageShape = {
  get recon() {
    return emptyStore()
  },
}

export async function get<K extends keyof StorageShape>(key: K): Promise<StorageShape[K]> {
  const result = await chrome.storage.local.get(key)
  return (result[key] as StorageShape[K] | undefined) ?? DEFAULTS[key]
}

export async function set<K extends keyof StorageShape>(
  key: K,
  value: StorageShape[K],
): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

export async function remove(key: keyof StorageShape): Promise<void> {
  await chrome.storage.local.remove(key)
}
