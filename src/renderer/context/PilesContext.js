import {
  useState,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useLocation } from 'react-router-dom';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import {
  createDirectory as capacitorCreateDirectory,
  // getFiles as capacitorGetFiles, // This can be used for isDirectoryEmpty if needed from fileOperations
} from '../utils/fileOperations'; // Assuming this is already refactored

export const availableThemes = {
  light: { primary: '#ddd', secondary: '#fff' },
  blue: { primary: '#a4d5ff', secondary: '#fff' },
  purple: { primary: '#d014e1', secondary: '#fff' },
  yellow: { primary: '#ff9634', secondary: '#fff' },
  green: { primary: '#22ff00', secondary: '#fff' },
};

export const PilesContext = createContext();

export const PilesContextProvider = ({ children }) => {
  const location = useLocation();
  const [currentPile, setCurrentPile] = useState(null);
  const [piles, setPiles] = useState([]);

  const CONFIG_FILE_PATH = 'piles.json'; // Relative to Directory.Data

  useEffect(() => {
    getConfig();
  }, []); // No need to re-run on location change for this simple config load

  useEffect(() => {
    if (!location.pathname || !location.pathname.startsWith('/pile/')) {
      setCurrentPile(null); // Clear current pile if not on a pile page
      return;
    }
    const currentPileName = location.pathname.split('/').pop();
    if (piles.length > 0) { // Ensure piles are loaded before trying to find one
        changeCurrentPile(currentPileName);
    }
  }, [location.pathname, piles]); // Re-run if piles array changes too

  const getConfig = async () => {
    try {
      // Check if file exists
      await Filesystem.stat({
        path: CONFIG_FILE_PATH,
        directory: Directory.Data,
      });
      const result = await Filesystem.readFile({
        path: CONFIG_FILE_PATH,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const jsonData = JSON.parse(result.data);
      setPiles(jsonData);
    } catch (error) {
      // File does not exist or other read error
      console.log('piles.json not found or error reading, creating new one.', error);
      try {
        await Filesystem.writeFile({
          path: CONFIG_FILE_PATH,
          data: JSON.stringify([]),
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        setPiles([]);
      } catch (writeError) {
        console.error('Error writing new piles.json:', writeError);
      }
    }
  };

  const getCurrentPilePath = (appendPath = '') => {
    if (!currentPile) return undefined;
    const pile = piles.find((p) => p.name === currentPile.name);
    if (!pile || !pile.path) return undefined;

    let fullPath = pile.path; // pile.path is relative to Directory.Data
    if (appendPath) {
      if (fullPath && !fullPath.endsWith('/')) {
        fullPath += '/';
      }
      fullPath += appendPath.startsWith('/') ? appendPath.substring(1) : appendPath;
    }
    return fullPath;
  };

  const writeConfig = async (_piles) => {
    if (!_piles) return;
    try {
      await Filesystem.writeFile({
        path: CONFIG_FILE_PATH,
        data: JSON.stringify(_piles),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
    } catch (error) {
      console.error('Error writing to config:', error);
    }
  };

  // Helper to check if a directory is empty using Capacitor
  // This specific function is not used in the refactored createPile below,
  // but kept if other parts of the app need it.
  const isDirectoryEmptyCapacitor = async (path, directory = Directory.Data) => {
    try {
      const result = await Filesystem.readdir({ path, directory });
      return result.files.length === 0;
    } catch (e) {
      // If the directory doesn't exist, readdir throws. We can consider it "empty" for our use case.
      if (e.message && (e.message.includes('Not found') || e.message.includes('ENOENT'))) {
        return true;
      }
      console.warn(`Error reading directory ${path} to check if empty:`, e);
      return false; // Default to not empty on other errors
    }
  };


  const createPile = async (name = '', selectedPath = null) => {
    // selectedPath is now the name of the directory for the pile (e.g., "MyNewPile")
    // All piles are created directly under Directory.Data
    if (name === '' || selectedPath === null) {
        console.error("Pile name and path (which is the pile's root dir name) must be provided");
        return; // Or throw an error / notify user
    }

    const pilePath = selectedPath; // pilePath is relative to Directory.Data, e.g., "MyNewPile"

    if (piles.find((p) => p.name === name)) {
      console.warn(`Pile with name "${name}" already exists.`);
      return;
    }

    try {
      // Ensure the pile's dedicated directory exists under Directory.Data
      await capacitorCreateDirectory(pilePath); // capacitorCreateDirectory uses Filesystem.mkdir with Directory.Data
      console.log(`Directory for pile "${name}" at "${pilePath}" ensured.`);

      const newPiles = [{ name, path: pilePath, theme: 'light' }, ...piles];
      setPiles(newPiles);
      await writeConfig(newPiles);
      return name;

    } catch (error) {
        console.error(`Failed to create pile directory for ${name}:`, error);
        // Optionally, revert any state changes if part of the process failed
        return;
    }
  };


  const changeCurrentPile = (name) => {
    if (!piles || piles.length === 0) return;
    const pile = piles.find((p) => p.name === name);
    setCurrentPile(pile);
  };

  const deletePile = async (name) => {
    if (!piles || piles.length === 0) return;
    const pileToDelete = piles.find(p => p.name === name);
    if (!pileToDelete) return;

    const newPiles = piles.filter((p) => p.name !== name);
    setPiles(newPiles);
    await writeConfig(newPiles);

    // Note: Original code did not delete the folder. Matching that behavior.
    // If folder deletion is desired:
    // try {
    //   await Filesystem.rmdir({
    //     path: pileToDelete.path, // This path is relative to Directory.Data
    //     directory: Directory.Data,
    //     recursive: true, // Remove all contents
    //   });
    //   console.log(`Directory for pile "${name}" at "${pileToDelete.path}" deleted.`);
    // } catch (error) {
    //   console.error(`Error deleting directory for pile "${name}":`, error);
    // }
  };

  const updateCurrentPile = async (newPile) => {
    const newPiles = piles.map((pile) => {
      // Assuming currentPile.path is the unique identifier for comparison
      if (currentPile && pile.path === currentPile.path) {
        return newPile;
      }
      return pile;
    });
    await writeConfig(newPiles);
    setPiles(newPiles);
    setCurrentPile(newPile);
  };

  const currentTheme = useMemo(() => {
    return currentPile?.theme ?? 'light';
  }, [currentPile]);

  const setTheme = useCallback(
    (theme = 'light') => {
      if (!currentPile) return;
      const valid = Object.keys(availableThemes);
      if (!valid.includes(theme)) return;
      const _pile = { ...currentPile, theme: theme };
      updateCurrentPile(_pile);
    },
    [currentPile, piles]
  );

  const pilesContextValue = {
    piles,
    getCurrentPilePath,
    createPile,
    currentPile,
    deletePile,
    currentTheme,
    setTheme,
    updateCurrentPile,
    getConfig,
  };

  return (
    <PilesContext.Provider value={pilesContextValue}>
      {children}
    </PilesContext.Provider>
  );
};

export const usePilesContext = () => useContext(PilesContext);
