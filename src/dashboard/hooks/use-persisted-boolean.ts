import { useCallback, useEffect, useState } from "react";

export function usePersistedBoolean(storageKey: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(storageKey);

    if (storedValue !== null) {
      setValue(storedValue === "true");
    }
  }, [storageKey]);

  const updateValue = useCallback((nextValue: boolean) => {
    setValue(nextValue);
    window.localStorage.setItem(storageKey, String(nextValue));
  }, [storageKey]);

  return [value, updateValue] as const;
}
