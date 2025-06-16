import { useParams } from 'react-router-dom';
import styles from './Posts.module.scss';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import Store from 'electron-store';
import { useIndexContext } from 'renderer/context/IndexContext';
import Post from './Post';
import NewPost from '../NewPost';
import { AnimatePresence, motion } from 'framer-motion';
import debounce from 'renderer/utils/debounce';
import VirtualList from './VirtualList';

const store = new Store();

export default function Posts() {
  const { index, updateIndex } = useIndexContext();
  const [data, setData] = useState([]);
  const [sortOrder, setSortOrder] = useState(
    store.get('sortOrder', 'parentPost')
  );

  // Listen for changes in sortOrder from electron-store
  useEffect(() => {
    const unsubscribe = store.onDidChange('sortOrder', (newValue) => {
      setSortOrder(newValue);
    });
    return unsubscribe; // Cleanup listener on component unmount
  }, []);

  // We use this to generate the data array which consists of
  // all the items that are going to be rendered on the virtual list.
  // The actual sorting is now done in main process (pileIndex.js)
  useEffect(() => {
    let processedEntries = [];

    if (sortOrder === 'mostRecentMessage') {
      // For 'mostRecentMessage', use all entries from the index directly,
      // as they are already sorted by updatedAt by pileIndex.js
      processedEntries = [...index.entries()];
    } else {
      // For 'parentPost' (default), filter for non-reply entries.
      // These are already sorted by createdAt by pileIndex.js.
      const parentEntries = [];
      for (const [key, metadata] of index) {
        if (!metadata.isReply) {
          parentEntries.push([key, metadata]);
        }
      }
      processedEntries = parentEntries;
    }

    const finalData = [
      ['NewPost', { height: 150, hash: Date.now().toString() }],
      ...processedEntries,
    ];
    setData(finalData);
  }, [index, sortOrder]);

  const renderList = useMemo(() => {
    return <VirtualList data={data} />;
  }, [data]);

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
