import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const postFormat = {
  title: '',
  content: null,
  createdAt: null,
  updatedAt: null,
  attachments: [],
  color: null,
  area: null,
  tags: [],
  replies: [],
  isReply: false,
  isAI: false,
};

// This function's relevance is reduced with Capacitor.
// Paths will generally be relative to Directory.Data or Directory.Documents.
// For now, it will simply return the parent part of a relative path.
const getDirectoryPath = (filePath) => {
  const pathArr = filePath.split('/'); // Assume POSIX paths for Capacitor
  pathArr.pop();
  return pathArr.join('/');
};

const getFormattedTimestamp = () => {
  const currentDate = new Date();
  const year = String(currentDate.getFullYear()).slice(-2);
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const hours = String(currentDate.getHours()).padStart(2, '0');
  const minutes = String(currentDate.getMinutes()).padStart(2, '0');
  const seconds = String(currentDate.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}.md`;
};

// basePath is now relative to Directory.Data
const getFilePathForNewPost = (basePath, timestamp = new Date()) => {
  const date = new Date(timestamp); // Ensure timestamp is a Date object
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear().toString();
  const fileName = getFormattedTimestamp(); // Uses current date for filename, consider passing timestamp

  // Construct path segments carefully for Capacitor
  let path = basePath;
  if (path && !path.endsWith('/')) {
    path += '/';
  }
  path += `${year}/${month}/${fileName}`;
  // Remove leading slash if present, as paths are relative to Directory.Data
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  return path;
};

// directoryPath is relative to Directory.Data
const createDirectory = async (directoryPath) => {
  try {
    await Filesystem.mkdir({
      path: directoryPath,
      directory: Directory.Data,
      recursive: true, // Create parent directories if they don't exist
    });
  } catch (error) {
    console.error(`Error creating directory ${directoryPath}:`, error);
    // Optionally re-throw or handle as per application needs
    // For now, logging the error. If the directory already exists, mkdir might throw an error.
    // Capacitor's mkdir does not throw an error if the directory already exists and recursive is true.
  }
};

// dir is relative to Directory.Data
const getFiles = async (dir) => {
  try {
    const result = await Filesystem.readdir({
      path: dir,
      directory: Directory.Data,
    });
    // The result is { files: [{ name: string, type: string, uri: string, mtime: number, size: number }] }
    // The original window.electron.getFiles might have returned a simpler array of names or objects.
    // This might require adjustments in the calling code. For now, returning the files array.
    return result.files;
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
    return []; // Return empty array on error
  }
};

// path is relative to Directory.Data. fileData is a string.
const saveFile = async (path, fileData) => {
  try {
    await Filesystem.writeFile({
      path: path,
      data: fileData,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  } catch (error) {
    console.error(`Error writing file ${path}:`, error);
    throw error; // Re-throw to allow calling code to handle
  }
};

// path is relative to Directory.Data
const deleteFile = async (path) => {
  try {
    await Filesystem.deleteFile({
      path: path,
      directory: Directory.Data,
    });
  } catch (error) {
    console.error(`Error deleting file ${path}:`, error);
    throw error; // Re-throw to allow calling code to handle
  }
};

// This function uses ipc.invoke, which is handled by the polyfill or Electron itself.
const generateMarkdown = (content, data) => {
  return window.electron.ipc.invoke('matter-stringify', { content, data });
};

export {
  postFormat,
  createDirectory,
  saveFile,
  deleteFile,
  getFiles,
  getDirectoryPath,
  getFilePathForNewPost,
  generateMarkdown,
};
