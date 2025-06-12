import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
// import { FilePicker } from '@capacitor/file-picker'; // Future replacement for 'open-file'
import {
  // generateMarkdown, // Already using ipc.invoke for matter-stringify
  // createDirectory, // Not directly used here, but available from fileOperations
  // saveFile, // We'll use Filesystem.writeFile directly here
  // deleteFile, // We'll use Filesystem.deleteFile directly here
  getFilePathForNewPost, // Might be useful for generating attachment filenames
  // getDirectoryPath,
} from '../utils/fileOperations';

// Helper for simple path joining, ensures no double slashes and handles undefined/empty parts
const joinCapacitorPaths = (...parts) => {
  return parts.filter(p => p).join('/').replace(/\/\//g, '/');
};

export const getPost = async (postPath) => { // postPath is relative to Directory.Data
  try {
    if (!postPath) return undefined; // Return undefined for clarity

    const result = await Filesystem.readFile({
      path: postPath,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    // matter-parse is still an IPC call, polyfill returns undefined or basic content.
    // A proper JS-based frontmatter parser will be needed for full functionality.
    const parsed = await window.electron.ipc.invoke(
      'matter-parse', // This will be 'matter-parse'
      result.data
    );

    if (!parsed) { // Handle case where polyfill returns undefined
        console.warn(`matter-parse returned undefined for ${postPath}. Using raw content.`);
        return { content: result.data, data: {} }; // Basic fallback
    }
    return { content: parsed.content, data: parsed.data };
  } catch (error) {
    console.error(`Error getting post ${postPath}:`, error);
    return undefined; // Return undefined on error
  }
};

export const attachToPostCreator =
  (setPost, getCurrentPilePath) => async (imageData, fileExtension) => {
    const pileRootPath = getCurrentPilePath(); // e.g., "MyNotesPile" (relative to Directory.Data)
    if (!pileRootPath) {
      console.error("Cannot attach file: current pile path not found.");
      return;
    }

    const attachmentsDir = joinCapacitorPaths(pileRootPath, '_attachments');
    try {
        // Ensure attachments directory exists for the pile
        await Filesystem.mkdir({ path: attachmentsDir, directory: Directory.Data, recursive: true });
    } catch (e) {
        // Ignore if dir already exists, log other errors
        if (!e.message || !e.message.toLowerCase().includes('already exists')) {
            console.error("Failed to create _attachments directory", e);
            return;
        }
    }

    let newAttachmentPathsRelative = []; // Paths relative to pile root

    if (imageData) { // Pasted image data
      const timestamp = new Date().getTime();
      const attachmentFileName = `img_${timestamp}.${fileExtension || 'png'}`;
      const attachmentSavePath = joinCapacitorPaths(attachmentsDir, attachmentFileName); // Relative to Directory.Data

      try {
        await Filesystem.writeFile({
          path: attachmentSavePath,
          data: imageData, // Assuming imageData is base64 or a string. If raw binary, needs conversion for some platforms.
          directory: Directory.Data,
          // Encoding might be needed if it's not base64, e.g. Encoding.UTF8 for text-based data
        });
        newAttachmentPathsRelative.push(joinCapacitorPaths('_attachments', attachmentFileName));
      } catch (error) {
        console.error('Failed to save pasted image:', error);
        return; // Stop if saving failed
      }
    } else { // User picking a file
      console.warn("DUMMY: 'open-file' (FilePicker) not implemented yet. No file selected.");
      // Placeholder for FilePicker functionality
      // try {
      //   const result = await FilePicker.pickFiles({
      //     multiple: true,
      //     // types: ['image/*', 'application/pdf', etc.] // Define types if needed
      //   });
      //   for (const file of result.files) {
      //     const attachmentFileName = `file_${new Date().getTime()}_${file.name}`;
      //     const attachmentSavePath = joinCapacitorPaths(attachmentsDir, attachmentFileName);
      //     // Read file content (file.data is usually base64 from FilePicker)
      //     await Filesystem.writeFile({ path: attachmentSavePath, data: file.data, directory: Directory.Data });
      //     newAttachmentPathsRelative.push(joinCapacitorPaths('_attachments', attachmentFileName));
      //   }
      // } catch (error) {
      //   console.error('File picking failed or cancelled:', error);
      //   // Don't stop, user might have cancelled
      // }
    }

    if (newAttachmentPathsRelative.length > 0) {
      setPost((post) => {
        const attachments = [...newAttachmentPathsRelative, ...post.data.attachments];
        return {
          ...post,
          data: { ...post.data, attachments },
        };
      });
    }
  };

export const detachFromPostCreator =
  (setPost, getCurrentPilePath) => async (attachmentPathRelToPile) => { // attachmentPath is relative to pile root
    const pileRootPath = getCurrentPilePath();
    if (!pileRootPath) {
      console.error("Cannot detach file: current pile path not found.");
      return;
    }

    const fullAttachmentPath = joinCapacitorPaths(pileRootPath, attachmentPathRelToPile); // Relative to Directory.Data

    setPost((post) => {
      const newAttachments = post.data.attachments.filter(
        (a) => a !== attachmentPathRelToPile
      );
      return {
        ...post,
        data: { ...post.data, attachments: newAttachments },
      };
    });

    try {
      await Filesystem.deleteFile({
        path: fullAttachmentPath,
        directory: Directory.Data,
      });
      console.log('Attachment deleted:', fullAttachmentPath);
    } catch (error) {
      console.error('Error deleting attachment file:', error);
      // Note: The state was updated even if file deletion failed. Consider if this is desired.
    }
  };

// --- The rest of the functions (tagActionsCreator, setHighlightCreator, cycleColorCreator) ---
// --- do not use Electron IPC directly and should remain as they are. ---

export const tagActionsCreator = (setPost, action) => {
  return (tag) => {
    setPost((post) => {
      if (action === 'add' && !post.data.tags.includes(tag)) {
        return {
          ...post,
          data: {
            ...post.data,
            tags: [...post.data.tags, tag],
          },
        };
      }
      if (action === 'remove' && post.data.tags.includes(tag)) {
        return {
          ...post,
          data: {
            ...post.data,
            tags: post.data.tags.filter((t) => t !== tag),
          },
        };
      }
      return post;
    });
  };
};

export const setHighlightCreator = (post, setPost, savePost) => {
  return (highlight) => {
    setPost((post) => ({
      ...post,
      data: { ...post.data, highlight: highlight },
    }));
    // savePost is from usePost hook, which now uses Capacitor's saveFile.
    savePost({ highlight: highlight });
  };
};

export const cycleColorCreator = (post, setPost, savePost, highlightColors) => {
  return () => {
    if (!post.data.highlightColor) {
      const newColor = highlightColors[1];
      setPost((post) => ({
        ...post,
        data: { ...post.data, highlightColor: newColor },
      }));
      savePost({ highlightColor: newColor });
      return;
    }
    const currentColor = post.data.highlightColor;
    const currentIndex = highlightColors.findIndex(
      (color) => color === currentColor
    );
    const nextIndex = (currentIndex + 1) % highlightColors.length;
    const nextColor = highlightColors[nextIndex];

    setPost((post) => ({
      ...post,
      data: { ...post.data, highlightColor: nextColor },
    }));
    savePost({ highlightColor: nextColor });
  };
};
