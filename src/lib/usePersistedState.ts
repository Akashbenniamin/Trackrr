import { useState, useCallback } from 'react';

const inMemoryStateMap = new Map<string, any>();

export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (inMemoryStateMap.has(key)) {
      return inMemoryStateMap.get(key) as T;
    }
    return defaultValue;
  });

  const set = useCallback((v: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      inMemoryStateMap.set(key, next);
      return next;
    });
  }, [key]);

  return [state, set];
}
