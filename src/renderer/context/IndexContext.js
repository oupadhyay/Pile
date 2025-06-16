import {
  useState,
  createContext,
  useContext,
  useEffect,
  useCallback,
} from 'react';
import { useLocation } from 'react-router-dom';
import { usePilesContext } from './PilesContext';

export const IndexContext = createContext();

export const IndexContextProvider = ({ children }) => {
  const { currentPile, getCurrentPilePath } = usePilesContext();
  const [filters, setFilters] = useState();
  const [searchOpen, setSearchOpen] = useState(false);
  const [index, setIndex] = useState(new Map());
  const [latestThreads, setLatestThreads] = useState([]);

  useEffect(() => {
    if (currentPile) {
      loadIndex(getCurrentPilePath());
      loadLatestThreads();
    }
  }, [currentPile]);

  // Effect to listen for index-updated events from main process
  useEffect(() => {
    const handleIndexUpdated = () => {
      console.log('Received index-updated event, refreshing index.');
      refreshIndex();
    };
    window.electron.ipc.on('index-updated', handleIndexUpdated);

    return () => {
      window.electron.ipc.removeListener('index-updated', handleIndexUpdated);
    };
  }, [refreshIndex]); // refreshIndex is stable due to useCallback

  const loadIndex = useCallback(async (pilePath) => {
    const newIndex = await window.electron.ipc.invoke('index-load', pilePath);
    const newMap = new Map(newIndex);
    setIndex(newMap);
  }, []);

  const refreshIndex = useCallback(async () => {
    const newIndex = await window.electron.ipc.invoke('index-get');
    const newMap = new Map(newIndex);
    setIndex(newMap);
  }, []);

  const prependIndex = useCallback((key, value) => {
    console.log('prepend index', key, value)
    setIndex((prevIndex) => {
      const newIndex = new Map([[key, value], ...prevIndex]);
      return newIndex;
    });
  }, []);

  const addIndex = useCallback(
    async (newEntryPath, parentPath = null) => {
      console.time('index-add-time');
      const pilePath = getCurrentPilePath();

      await window.electron.ipc
      .invoke('index-add', newEntryPath)
      .then((index) => {
        // setIndex(index);
        loadLatestThreads();
      });
      console.timeEnd('index-add-time');
    },
    [currentPile]
  );

  const regenerateEmbeddings = () => {
    window.electron.ipc.invoke('index-regenerate-embeddings');
  };

  const getThreadsAsText = useCallback(async (filePaths) => {
    return window.electron.ipc.invoke('index-get-threads-as-text', filePaths);
  }, []);

  const updateIndex = useCallback(async (filePath, data) => {
    window.electron.ipc.invoke('index-update', filePath, data).then((index) => {
      setIndex(index);
      loadLatestThreads();
    });
  }, []);

  const removeIndex = useCallback(async (filePath) => {
    window.electron.ipc.invoke('index-remove', filePath).then((index) => {
      setIndex(index);
    });
  }, []);

  const search = useCallback(async (query) => {
    return window.electron.ipc.invoke('index-search', query);
  }, []);

  const vectorSearch = useCallback(async (query, topN = 50) => {
    return window.electron.ipc.invoke('index-vector-search', query, topN);
  }, []);

  const loadLatestThreads = useCallback(async (count = 25) => {
    const items = await search('');
    const latest = items.slice(0, count);

    const entryFilePaths = latest.map((entry) => entry.ref);
    const latestThreadsAsText = await getThreadsAsText(entryFilePaths);

    setLatestThreads(latestThreadsAsText);
  }, []);

  const indexContextValue = {
    index,
    refreshIndex,
    addIndex,
    removeIndex,
    updateIndex,
    search,
    searchOpen,
    setSearchOpen,
    vectorSearch,
    getThreadsAsText,
    latestThreads,
    regenerateEmbeddings,
    prependIndex
  };

  return (
    <IndexContext.Provider value={indexContextValue}>
      {children}
    </IndexContext.Provider>
  );
};

export const useIndexContext = () => useContext(IndexContext);
