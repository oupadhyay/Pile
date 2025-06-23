import { useParams } from 'react-router-dom';
import styles from './Posts.module.scss';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';

import { useIndexContext } from 'renderer/context/IndexContext';
import Post from './Post';
import NewPost from '../NewPost';
import { AnimatePresence, motion } from 'framer-motion';
import debounce from 'renderer/utils/debounce';
import VirtualList from './VirtualList';

export default function Posts() {
  const { index, updateIndex } = useIndexContext();
  const [data, setData] = useState([]);
  const [sortOrder, setSortOrder] = useState('parentPost');

  // Load sort order from settings and listen for index updates
  useEffect(() => {
    const loadSortOrder = async () => {
      const savedSortOrder = await window.electron.settingsGet('sortOrder');
      setSortOrder(savedSortOrder || 'parentPost');
    };

    loadSortOrder();

    // Listen for index updates (which happen when sort order changes)
    const handleIndexUpdate = () => {
      loadSortOrder();
    };

    window.electron.ipc.on('index-updated', handleIndexUpdate);

    return () => {
      window.electron.ipc.removeListener('index-updated', handleIndexUpdate);
    };
  }, []);

  // We use this to generate the data array which consists of
  // all the items that are going to be rendered on the virtual list.
  // The `index` from useIndexContext() is ALREADY:
  // 1. Filtered to include only parent posts.
  // 2. Sorted according to the global 'sortOrder' setting by PileIndex.js.
  useEffect(() => {
    const processedEntries = [...index.entries()]; // Already sorted parent posts

    // Add a stable placeholder for the NewPost component.
    // This placeholder will be identified by Posts/VirtualList.jsx to render the NewPost component.
    const finalData = [
      ['new-post-placeholder-key', { type: 'NEW_POST_COMPONENT' }],
      ...processedEntries,
    ];
    setData(finalData);
  }, [index]); // Only depends on index, as index changes when sortOrder or content changes.

  const renderList = useMemo(() => {
    // Using sortOrder as key can help ensure Virtuoso remounts if its internal state
    // doesn't perfectly handle data source changes that also imply new visual orderings.
    // With robust computeItemKey in VirtualList, this might be optional but acts as a safeguard.
    return <VirtualList key={sortOrder} data={data} />;
  }, [data, sortOrder]);

  // When there are zero entries
  if (index.size == 0) {
    return (
      <div className={styles.posts}>
        <NewPost />
        <div className={styles.empty}>
          <div className={styles.wrapper}>
            <div className={styles.none}>Say something?</div>
            <div className={styles.tip}>
              Pile is ideal for journaling in bursts– type down what you're
              thinking right now, come back to it over time.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.posts}>
      <AnimatePresence>{renderList}</AnimatePresence>
      <div className={styles.gradient}></div>
    </div>
  );
}
