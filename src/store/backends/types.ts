import type { TaskloomData } from "../types.js";

// Shared backend contracts. LEAF: types only.
export interface StoreBackend {
  key: string;
  load(): TaskloomData;
  persist(data: TaskloomData): void;
  reset(): TaskloomData;
}

export interface AsyncStoreBackend {
  key: string;
  load(): Promise<TaskloomData>;
  mutate<T>(mutator: (data: TaskloomData) => T | Promise<T>): Promise<T>;
}
