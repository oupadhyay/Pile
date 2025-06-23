import { useParams } from 'react-router-dom';
import styles from './Chat.module.scss';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  memo,
  useLayoutEffect,
} from 'react';
import { useIndexContext } from 'renderer/context/IndexContext';
import { AnimatePresence, motion } from 'framer-motion';
import debounce from 'renderer/utils/debounce';
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual';
import { useWindowResize } from 'renderer/hooks/useWindowResize';
import { Virtuoso } from 'react-virtuoso';
import { useTimelineContext } from 'renderer/context/TimelineContext';
import Scrollbar from './Scrollbar';
import Intro from './Intro';
import Message from './Message';

const VirtualList = memo(({ data }) => {
  const virtualListRef = useRef();
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Scroll to bottom when the component mounts or data initially loads to a significant length
  useEffect(() => {
    if (dataRef.current && dataRef.current.length > 0) {
      // Initial scroll to bottom.
      // The followOutput='smooth' prop should handle subsequent appends.
      // This explicit scroll might be for initial load or after a full data replacement.
      scrollToBottom('auto'); // 'auto' might be better for initial load
    }
  }, [virtualListRef]); // Only on mount essentially, or if virtualListRef changes.

  const scrollToBottom = useCallback((align = 'end') => {
    const currentDataLength = dataRef.current ? dataRef.current.length : 0;
    if (virtualListRef?.current && currentDataLength > 0) {
      virtualListRef.current.scrollToIndex({
        index: currentDataLength - 1,
        align,
      });
    }
  }, []); // Now stable

  const renderItem = useCallback(
    (index, item) => ( // item is [filePath, metadata]
      <Message
        index={index}
        message={item} // Pass the [filePath, metadata] tuple
        scrollToBottom={scrollToBottom}
      />
    ),
    [scrollToBottom] // Now stable if scrollToBottom is stable
  );

  // Use the unique file path (item[0]) as the key
  const computeItemKey = useCallback((index, item) => {
    if (!item || typeof item[0] !== 'string') {
      console.warn('Virtuoso item key generation: item or item[0] is invalid', item);
      return `${index}-invalid-item`; // Fallback key
    }
    return item[0]; // item[0] is the filePath
  }, []); // Stable

  return (
    <Virtuoso
      ref={virtualListRef}
      data={data} // data is an array of [filePath, metadata]
      itemContent={renderItem}
      computeItemKey={computeItemKey}
      overscan={500}
      initialTopMostItemIndex={data.length - 1}
      followOutput={'smooth'}
      components={{
        Header: Intro,
        Footer: () => (
          <div
            style={{
              paddingTop: '140px',
            }}
          ></div>
        ),
        Scroller: Scrollbar,
      }}
    />
  );
});

export default VirtualList;
