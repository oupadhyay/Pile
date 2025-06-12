import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePilesContext } from 'renderer/context/PilesContext';
import * as fileOperations from '../utils/fileOperations';
import { useIndexContext } from 'renderer/context/IndexContext';
import {
  getPost,
  cycleColorCreator,
  tagActionsCreator,
  attachToPostCreator,
  detachFromPostCreator,
  setHighlightCreator,
} from './usePostHelpers';

const highlightColors = [
  'var(--border)',
  'var(--base-yellow)',
  'var(--base-green)',
];

const defaultPost = {
  content: '',
  data: {
    title: '',
    createdAt: null,
    updatedAt: null,
    highlight: null,
    highlightColor: null,
    tags: [],
    replies: [],
    attachments: [],
    isReply: false,
    isAI: false,
  },
};

function usePost(
  postPath = null, // relative path
  {
    isReply = false,
    isAI = false,
    parentPostPath = null, // relative path
    reloadParentPost = () => {},
  } = {}
) {
  const { currentPile, getCurrentPilePath } = usePilesContext();
  const { addIndex, removeIndex, refreshIndex, updateIndex, prependIndex } =
    useIndexContext();
  const [updates, setUpdates] = useState(0);
  const [path, setPath] = useState(); // absolute path
  const [post, setPost] = useState({ ...defaultPost });

  useEffect(() => {
    if (!postPath) return;
    // getCurrentPilePath() returns path relative to Directory.Data, or undefined
    // postPath is relative to pile root
    const pileRoot = getCurrentPilePath();
    if (pileRoot === undefined) {
      setPath(undefined); // Or handle error
      return;
    }
    // Simple path joining, ensuring no double slashes if postPath is empty or pileRoot ends with /
    let combinedPath = pileRoot;
    if (postPath) {
      if (combinedPath && !combinedPath.endsWith('/')) {
        combinedPath += '/';
      }
      combinedPath += postPath.startsWith('/') ? postPath.substring(1) : postPath;
    }
    setPath(combinedPath);
  }, [postPath, currentPile, getCurrentPilePath]);

  useEffect(() => {
    if (!path) return;
    refreshPost();
  }, [path]);

  const refreshPost = useCallback(async () => {
    if (!path) return;
    const freshPost = await getPost(path);
    setPost(freshPost);
  }, [path]);

  const savePost = useCallback(
    async (dataOverrides) => {
      console.time('post-time');

      const saveToPath = path
        ? path
        : fileOperations.getFilePathForNewPost(currentPile.path);
      const directoryPath = fileOperations.getDirectoryPath(saveToPath);
      const now = new Date().toISOString();
      const content = post.content;
      const data = {
        ...post.data,
        isAI: post.data.isAI === true ? post.data.isAI : isAI,
        isReply: post.data.createdAt ? post.data.isReply : isReply,
        createdAt: post.data.createdAt ?? now,
        updatedAt: now,
        ...dataOverrides,
      };

      try {
        const fileContents = await fileOperations.generateMarkdown(
          content,
          data
        );

        await fileOperations.createDirectory(directoryPath);
        await fileOperations.saveFile(saveToPath, fileContents);

        if (isReply) {
          await addReplyToParent(parentPostPath, saveToPath);
        }

        // saveToPath is relative to Directory.Data (e.g. MyPile/2023/Dec/file.md)
        // getCurrentPilePath() is the pile's root relative to Directory.Data (e.g. MyPile)
        const pileRootPath = getCurrentPilePath();
        let postRelativePath = saveToPath;
        if (pileRootPath && saveToPath.startsWith(pileRootPath)) {
          postRelativePath = saveToPath.substring(pileRootPath.length);
          if (postRelativePath.startsWith('/')) {
            postRelativePath = postRelativePath.substring(1);
          }
        }

        prependIndex(postRelativePath, data); // Add the file to the index
        addIndex(postRelativePath, parentPostPath); // Add the file to the index
        // 'tags-sync' invoke expects a path that the main process can understand.
        // If main process also switches to Capacitor paths, this might be okay.
        // For now, saveToPath (relative to Directory.Data) is passed.
        window.electron.ipc.invoke('tags-sync', saveToPath);
        console.timeEnd('post-time');
      } catch (error) {
        console.error(`Error writing file: ${saveToPath}`);
        console.error(error);
      }
    },
    [path, post, reloadParentPost]
  );

  const addReplyToParent = async (parentPostPath, replyPostPath) => {
    // replyPostPath is relative to Directory.Data (e.g., MyPile/2023/Dec/file.md)
    // We need the path relative to the pile root for storing in parent's replies array.
    const pileRoot = getCurrentPilePath(); // Path to current pile's root, e.g., "MyPile"
    let relativeReplyPath = replyPostPath;
    if (pileRoot && replyPostPath.startsWith(pileRoot)) {
      relativeReplyPath = replyPostPath.substring(pileRoot.length);
      if (relativeReplyPath.startsWith('/')) {
        relativeReplyPath = relativeReplyPath.substring(1); // e.g., "2023/Dec/file.md"
      }
    }

    const fullParentPostPath = getCurrentPilePath(parentPostPath);
    if (!fullParentPostPath) {
      console.error("Could not determine parent post path for adding reply.");
      return;
    }
    const parentPost = await getPost(fullParentPostPath);
    const content = parentPost.content;
    const data = {
      ...parentPost.data,
      replies: [...parentPost.data.replies, relativeReplyPath],
    };
    const fileContents = await fileOperations.generateMarkdown(content, data);
    await fileOperations.saveFile(fullParentPostPath, fileContents);
    updateIndex(parentPostPath, data);
    reloadParentPost(parentPostPath);
  };

  const deletePost = useCallback(async () => {
    if (!postPath) return null;
    const fullPostPath = getCurrentPilePath(postPath);

    // if reply, remove from parent
    if (post.data.isReply && parentPostPath) {
      const fullParentPostPath = getCurrentPilePath(parentPostPath);
      const parentPost = await getPost(fullParentPostPath);
      const content = parentPost.content;
      const newReplies = parentPost.data.replies.filter((p) => {
        return p !== postPath;
      });
      const data = {
        ...parentPost.data,
        replies: newReplies,
      };
      const fileContents = await fileOperations.generateMarkdown(content, data);
      await fileOperations.saveFile(fullParentPostPath, fileContents);
      await reloadParentPost();
    }

    // delete file and remove from index
    await fileOperations.deleteFile(fullPostPath);
    removeIndex(postPath);
  }, [postPath, reloadParentPost, parentPostPath, post]);

  const postActions = useMemo(
    () => ({
      setContent: (content) => setPost((post) => ({ ...post, content })),
      updateData: (data) =>
        setPost((post) => ({ ...post, data: { ...post.data, ...data } })),
      cycleColor: cycleColorCreator(post, setPost, savePost, highlightColors),
      setHighlight: setHighlightCreator(post, setPost, savePost),
      addTag: tagActionsCreator(setPost, 'add'),
      removeTag: tagActionsCreator(setPost, 'remove'),
      attachToPost: attachToPostCreator(setPost, getCurrentPilePath),
      detachFromPost: detachFromPostCreator(setPost, getCurrentPilePath),
      resetPost: () => setPost(defaultPost),
    }),
    [post]
  );

  return {
    defaultPost,
    post,
    savePost,
    refreshPost,
    deletePost,
    ...postActions,
  };
}

export default usePost;
