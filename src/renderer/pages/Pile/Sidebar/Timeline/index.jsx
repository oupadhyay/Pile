import { useParams } from 'react-router-dom';
import styles from './Timeline.module.scss';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  useEffect,
  useStatem,
  useRef,
  useState,
  memo,
  useMemo,
  useCallback,
} from 'react';
import { DateTime } from 'luxon';
import Store from 'electron-store';
import { useTimelineContext } from 'renderer/context/TimelineContext';
import { useIndexContext } from 'renderer/context/IndexContext';

function isToday(date) {
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

const countEntriesByDate = (map, targetDate) => {
  let count = 0;
  const targetDateString = targetDate.toISOString().substring(0, 10);
  for (const [key, value] of map.entries()) {
    try {
      const createdAtDate = new Date(value.createdAt);
      const localDateString = new Date(
        createdAtDate.getFullYear(),
        createdAtDate.getMonth(),
        createdAtDate.getDate()
      )
        .toISOString()
        .substring(0, 10);
      if (localDateString === targetDateString) {
        count++;
      }
    } catch (error) {}
  }
  return count;
};

const renderCount = (count) => {
  const maxDots = Math.min(count, 48);
  return (
    <div className={styles.counts}>
      {Array.from({ length: maxDots }, (_, i) => i).map((_, i) => (
        <div className={styles.count} key={i}></div>
      ))}
    </div>
  );
};

const DayComponent = memo(({ date, scrollToDate }) => {
  const { index } = useIndexContext();
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dayName = dayNames[date.getDay()];
  const dayNumber = date.getDate();
  const count = countEntriesByDate(index, date);

  return (
    <div
      onClick={() => {
        scrollToDate(date);
      }}
      className={`${styles.day} ${isToday(date) && styles.today} ${
        dayName == 'S' && styles.monday
      }`}
    >
      {renderCount(count)}
      <div className={styles.dayLine}></div>
      <div className={styles.dayName}>{dayName}</div>
      <div className={styles.dayNumber}>{dayNumber}</div>
    </div>
  );
});

const WeekComponent = memo(({ startDate, endDate, scrollToDate }) => {
  const weekOfMonth = Math.floor(startDate.getDate() / 7) + 1;
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthName = monthNames[startDate.getMonth()];
  const year = startDate.getFullYear();
  let days = [];
  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    days.push(
      <DayComponent
        key={date.toString()}
        date={new Date(date)}
        scrollToDate={scrollToDate}
      />
    );
  }

  const weekOfMonthText = () => {
    switch (weekOfMonth) {
      case 1:
        return '1st week';
        break;
      case 2:
        return '2nd week';
        break;
      case 3:
        return '3rd week';
        break;
      case 4:
        return '4th week';
        break;
      default:
        return '';
    }
  };

  return (
    <div className={styles.week}>
      <div className={styles.text}>
        {monthName.substring(0, 3)} {year}
      </div>
      {days.reverse()}
      <div className={styles.line}></div>
    </div>
  );
});

const Timeline = memo(() => {
  const scrollRef = useRef(null);
  const scrubRef = useRef(null);
  const { index } = useIndexContext();
  const { visibleIndex, scrollToIndex, closestDate, setClosestDate } =
    useTimelineContext();
  const [parentEntries, setParentEntries] = useState([]);
  const [oldestDate, setOldestDate] = useState(new Date());
  const store = useRef(new Store()).current; // Use useRef to keep store instance stable
  const [sortOrder, setSortOrder] = useState(
    store.get('sortOrder', 'parentPost')
  );

  // Listen for sortOrder changes
  useEffect(() => {
    const unsubscribe = store.onDidChange('sortOrder', (newValue) => {
      setSortOrder(newValue);
    });
    return unsubscribe;
  }, [store]);

  //  Extract and sort parent entries
  useEffect(() => {
    if (!index) return;
    let onlyParentEntries = Array.from(index).filter(
      ([key, metadata]) => !metadata.isReply
    );

    // Sort based on sortOrder
    if (sortOrder === 'mostRecentMessage') {
      onlyParentEntries.sort(
        (a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0)
      );
    } else {
      // Default 'parentPost'
      onlyParentEntries.sort(
        (a, b) => (new Date(b[1].createdAt) || 0) - (new Date(a[1].createdAt) || 0)
      );
    }

    // Determine oldestDate based on the actual last entry after sorting
    // For 'parentPost', last entry is oldest. For 'mostRecentMessage', first entry is most recent, last is oldest.
    const lastEntryForOldestDate = onlyParentEntries[onlyParentEntries.length - 1];
    if (lastEntryForOldestDate) {
      // The timeline always progresses from newest (top) to oldest (bottom) visually after sorting.
      // So, the "oldestDate" for timeline generation purposes should be based on the createdAt of the last item.
      const oldestEntryTimestamp = lastEntryForOldestDate[1].createdAt;
      setOldestDate(new Date(oldestEntryTimestamp));
    } else {
      setOldestDate(new Date()); // Reset if no entries
    }

    setParentEntries(onlyParentEntries);
  }, [index, sortOrder]);

  // Identify most recent entry and it's date
  // This is for placing the scroller at the right position
  useEffect(() => {
    if (!parentEntries || parentEntries.length == 0) return;
    if (visibleIndex == 0) return;
    let current;
    if (parentEntries && visibleIndex > 0 && parentEntries[visibleIndex - 1]) {
      current = parentEntries[visibleIndex - 1][1];
    }
    if (!current) return;
    const createdAt = current.createdAt;
    setClosestDate(createdAt);
  }, [visibleIndex, parentEntries]);

  const scrollToDate = useCallback(
    (targetDate) => {
      try {
        let closestIndex = -1;
        let smallestDiff = Infinity;

        parentEntries.forEach((post, index) => {
          let postDate = new Date(post[1].createdAt);
          let diff = Math.abs(targetDate - postDate);
          if (diff < smallestDiff) {
            smallestDiff = diff;
            closestIndex = index;
          }
        });
        scrollToIndex(closestIndex);
      } catch (error) {
        console.error('Failed to scroll to entry', error);
      }
    },
    [parentEntries]
  );

  const getWeeks = useCallback(() => {
    let weeks = [];
    let now = new Date();
    now.setHours(0, 0, 0, 0);

    let weekEnd = new Date(now);

    while (now.getDay() !== 1) {
      now.setDate(now.getDate() - 1);
    }

    let weekStart = new Date(now);
    weeks.push({ start: weekStart, end: weekEnd });

    // Adding empty days to
    let oldestDatePadded = new Date(oldestDate);
    oldestDatePadded.setDate(oldestDatePadded.getDate() - 40);

    while (weekStart > oldestDatePadded) {
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() - 1);
      weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
    }

    return weeks;
  }, [oldestDate]);

  const createWeeks = () =>
    getWeeks().map((week, index) => (
      <WeekComponent
        key={index}
        startDate={week.start}
        endDate={week.end}
        scrollToDate={scrollToDate}
      />
    ));

  let weeks = useMemo(createWeeks, [parentEntries.length]);

  useEffect(() => {
    if (!scrubRef.current) return;
    if (!scrollRef.current) return;
    let oneDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const past = new Date(closestDate);
    let diffInMilliSeconds = Math.abs(now - past);
    let diffInDays = Math.round(diffInMilliSeconds / oneDay);

    let scrollOffset = 0;
    const distanceFromTop = 22 * diffInDays + 10;

    if (distanceFromTop > 400) {
      scrollOffset = distanceFromTop - 300;
    } else {
      scrollOffset = 0;
    }

    scrollRef.current.scroll({
      top: scrollOffset,
      behavior: 'smooth',
    });

    scrubRef.current.style.top = distanceFromTop + 'px';
  }, [closestDate]);

  return (
    <div ref={scrollRef} className={styles.timeline}>
      {weeks}
      <div ref={scrubRef} className={styles.scrubber}></div>
    </div>
  );
});

export default Timeline;
