import { useCallback, useState, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { motion } from 'framer-motion';
import { useTimelineContext } from 'renderer/context/TimelineContext';
import NewPost from '../NewPost';
import Post from './Post';
import Scrollbar from './Scrollbar';

const PostItem = memo(({ postPath, post }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ minHeight: 72, width: '100%' }}
    >
      <Post postPath={postPath} />
    </motion.div>
  );
});

const MemoizedNewPost = memo(() => <NewPost />);

const VirtualTimeline = memo(({ data }) => {
  const { virtualListRef, setVisibleIndex } = useTimelineContext();
  const [isScrolling, setIsScrolling] = useState(false);

  const handleRangeChanged = useCallback((range) => {
    setVisibleIndex(range.startIndex);
  }, [setVisibleIndex]);

  const renderItem = useCallback((index, entry) => {
    // entry is [key, payload] from the data array
    // Check if this is the placeholder for NewPost
    if (entry && entry[0] === 'new-post-placeholder-key') {
      return <MemoizedNewPost />;
    }

    // For actual posts, entry is [postPath, postMetadata]
    const [postPath, post] = entry;
    return <PostItem postPath={postPath} post={post} />;
  }, []); // Stable callback

  const getKey = useCallback((index, entry) => {
    // entry is [key, payload]
    // Check for the NewPost placeholder
    if (entry && entry[0] === 'new-post-placeholder-key') {
      return 'new-post-placeholder-key'; // Static key for the placeholder
    }

    // For actual posts, entry[0] is the postPath. This is the most stable key.
    // Using post.updatedAt here (entry[1].updatedAt) might cause unnecessary remounts if PostItem can handle updates.
    // For maximum stability for Virtuoso's item tracking during sorts, postPath alone is best.
    if (entry && typeof entry[0] === 'string') {
      return entry[0]; // Use postPath (entry[0]) as the stable key
    }

    // Fallback key if entry structure is unexpected for some reason
    console.warn("Unexpected entry structure in getKey:", entry);
    return `item-${index}`;
  }, []); // Stable callback

  return (
    <Virtuoso
      ref={virtualListRef}
      data={data}
      rangeChanged={handleRangeChanged}
      itemContent={renderItem}
      computeItemKey={getKey} // Use the updated getKey
      components={{
        Scroller: Scrollbar
      }}
      overscan={5}
      defaultItemHeight={220}
      style={{ height: '100%', width: '100%' }}
      initialTopMostItemIndex={0}
      followOutput={'smooth'}
      alignToBottom={false}
      components={{
        Scroller: Scrollbar,
        Footer: () => <div style={{ height: 20 }} />,
        EmptyPlaceholder: () => <div></div>,
      }}
    />
  );
});

VirtualTimeline.displayName = 'VirtualTimeline';

export default VirtualTimeline;
