if (typeof window.electron === 'undefined') {
  console.warn('Electron contextBridge not found, creating dummy polyfill for window.electron');
  window.electron = {
    ipc: {
      sendMessage: (...args) => console.log('DUMMY: ipc.sendMessage called', ...args),
      on: (...args) => {
        console.log('DUMMY: ipc.on called', ...args);
        return () => console.log('DUMMY: ipc.on cleanup');
      },
      once: (...args) => console.log('DUMMY: ipc.once called', ...args),
      invoke: (...args) => {
        console.log('DUMMY: ipc.invoke called', ...args);
        // For 'electron-store-get', return undefined or a default immediately
        if (args[0] === 'electron-store-get') return Promise.resolve(undefined);
        // For 'matter-stringify', return a simple string
        if (args[0] === 'matter-stringify') return Promise.resolve(args[1]?.content || '');
        // For 'get-files', return an empty array
        if (args[0] === 'get-files') return Promise.resolve([]);
        // For other invokes, return a generic promise
        return Promise.resolve(undefined);
      },
      removeAllListeners: (...args) => console.log('DUMMY: ipc.removeAllListeners called', ...args),
      removeListener: (...args) => console.log('DUMMY: ipc.removeListener called', ...args),
    },
    setupPilesFolder: (path) => console.log('DUMMY: setupPilesFolder called', path),
    getConfigPath: () => {
      console.log('DUMMY: getConfigPath called');
      return ''; // Return an empty string or a sensible default
    },
    openFolder: (folderPath) => console.log('DUMMY: openFolder called', folderPath),
    existsSync: (path) => {
      console.log('DUMMY: existsSync called', path);
      return false; // Assume file doesn't exist
    },
    readDir: (path, callback) => {
      console.log('DUMMY: readDir called', path);
      if (callback) callback(null, []); // Emulate empty directory
    },
    isDirEmpty: (path) => {
      console.log('DUMMY: isDirEmpty called', path);
      return true; // Assume directory is empty
    },
    readFile: (path, callback) => {
      console.log('DUMMY: readFile called', path);
      if (callback) callback(new Error('DUMMY: File not found'), null);
    },
    deleteFile: (path, callback) => {
      console.log('DUMMY: deleteFile called', path);
      if (callback) callback(null); // Assume success
    },
    writeFile: (path, data, callback) => {
      console.log('DUMMY: writeFile called', path);
      if (callback) callback(null); // Assume success
    },
    mkdir: (path) => {
      console.log('DUMMY: mkdir called', path);
      return Promise.resolve(); // Assume success
    },
    joinPath: (...args) => {
      console.log('DUMMY: joinPath called', ...args);
      return args.join('/'); // Basic POSIX-like join
    },
    isMac: false, // Default to not Mac
    isWindows: false, // Default to not Windows
    pathSeparator: '/', // Default to POSIX separator
    settingsGet: (key) => {
      console.log('DUMMY: settingsGet called directly (should be via ipc.invoke)', key);
      return Promise.resolve(undefined);
    },
    settingsSet: (key, value) => {
      console.log('DUMMY: settingsSet called directly (should be via ipc.invoke)', key, value);
      return Promise.resolve();
    },
    // Assuming getFiles is an invoke call like 'get-files'
    // If it were a direct method, it would be:
    // getFiles: (dir) => {
    //   console.log('DUMMY: getFiles called', dir);
    //   return Promise.resolve([]); // Emulate empty directory
    // }
  };
}

import { createRoot } from 'react-dom/client';
import App from './App';
import { MemoryRouter as Router } from 'react-router-dom';
import { isMac } from './utils/platformInfo'; // Import the new utility

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

const wrapperStyle = {
  // Use the new isMac(), understanding it might not be updated on initial sync render
  background: isMac() ? 'var(--bg-translucent)' : 'var(--bg)',
}

root.render(
  <Router>
    <div style={wrapperStyle}>
      <App />
    </div>
  </Router>
);
