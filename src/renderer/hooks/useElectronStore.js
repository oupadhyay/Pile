import { useState, useCallback, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';

export function useElectronStore(key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);

  useEffect(() => {
    Preferences.get({ key }).then(({ value }) => {
      if (value !== null && value !== undefined) { // Preferences returns null if key not found
        try {
          // Attempt to parse if it looks like JSON, as electron-store might store objects
          setStoredValue(JSON.parse(value));
        } catch (e) {
          // If not JSON, use the value directly (it might have been a simple string)
          setStoredValue(value);
        }
      } else {
        // Key not found, ensure initialValue is set if it's different from current state
        // This case is mostly covered by useState(initialValue), but good for explicit clarity
        setStoredValue(initialValue);
      }
    }).catch(error => {
      console.error(`Error getting preference for key ${key}:`, error);
      // Fallback to initialValue in case of error
      setStoredValue(initialValue);
    });
  }, [key, initialValue]); // Added initialValue to dependency array

  const setValue = useCallback(
    async (value) => { // Made async as Preferences.set is async
      try {
        const newValue = value instanceof Function ? value(storedValue) : value;
        setStoredValue(newValue);
        // Preferences stores strings. If newValue is an object/array, stringify it.
        const valueToStore = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
        await Preferences.set({ key, value: valueToStore });
      } catch (error) {
        console.error(`Error setting preference for key ${key}:`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}
