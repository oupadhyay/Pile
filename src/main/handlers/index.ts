import { ipcMain } from 'electron';
import pileIndex from '../utils/pileIndex';

ipcMain.handle('index-load', async (event, pilePath) => {
  const index = await pileIndex.load(pilePath);
  return index;
});

ipcMain.handle('index-get', (event) => {
  const index = pileIndex.get();
  return index;
});

ipcMain.handle('index-regenerate-embeddings', async (event) => {
  const index = await pileIndex.regenerateEmbeddings();
  return index;
});

ipcMain.handle('index-add', async (event, filePath) => {
  const index = await pileIndex.add(filePath);
  return index;
});

ipcMain.handle('index-update', async (event, filePath, data) => {
  const index = await pileIndex.update(filePath, data);
  return index;
});

ipcMain.handle('index-search', (event, query) => {
  const results = pileIndex.search(query);
  return results;
});

ipcMain.handle('index-vector-search', async (event, query, topN = 50) => {
  const results = await pileIndex.vectorSearch(query, topN);
  return results;
});

ipcMain.handle('index-get-threads-as-text', (event, filePaths = []) => {
  const results = [];

  for (const filePath of filePaths) {
    const entry = pileIndex.getThreadAsText(filePath);
    results.push(entry);
  }
  return results;
});

ipcMain.handle('index-remove', async (event, filePath) => {
  const index = await pileIndex.remove(filePath);
  return index;
});
