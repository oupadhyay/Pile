import { ipcMain } from 'electron';
import settings from 'electron-settings';

const pileIndex = require('../utils/pileIndex');

ipcMain.handle('electron-store-get', async (event, key) => {
  return await settings.get(key);
});

ipcMain.handle('electron-store-set', async (event, key, value) => {
  settings.set(key, value);

  // If sortOrder changed, trigger re-sort in pileIndex
  if (key === 'sortOrder') {
    await pileIndex.refreshSort();
  }
});
