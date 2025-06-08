/* eslint-disable no-use-before-define */
import {
  useState,
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';
import { usePilesContext } from './PilesContext';
import { useElectronStore } from '../hooks/useElectronStore';

// Helper function to convert HTML to plain text
const htmlToText = (html) => {
  if (!html) return '';

  // Create a temporary div element to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Extract text content and clean up whitespace
  return tempDiv.textContent || tempDiv.innerText || '';
};

const OPENAI_URL = 'https://api.openai.com/v1';

const DEFAULT_PROMPT =
  'You are an AI within a journaling app. Your job is to help the user reflect on their thoughts in a thoughtful and kind manner. The user can never directly address you or directly respond to you. Try not to repeat what the user said, instead try to seed new ideas, encourage or debate. Keep your responses concise, but meaningful. You can only respond in plaintext, do NOT use HTML.';

const getProviderBaseUrl = (provider) => {
  if (provider === 'openai') return OPENAI_URL;
  return null;
};

const getDefaultModel = (provider) => {
  if (provider === 'openai') return 'gpt-4o';
  if (provider === 'gemini') return 'gemini-2.0-flash';
  if (provider === 'ollama') return 'llama3'; // Or any default
  return 'gpt-4o';
};

export const AIContext = createContext();

export function AIContextProvider({ children }) {
  const { currentPile, updateCurrentPile } = usePilesContext();
  const [ai, setAi] = useState(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [pileAIProvider, setPileAIProvider] = useElectronStore(
    'pileAIProvider',
    'openai',
  );
  const [model, setModel] = useElectronStore(
    'model',
    getDefaultModel('openai'),
  );
  const [embeddingModel, setEmbeddingModel] = useElectronStore(
    'embeddingModel',
    'mxbai-embed-large',
  );
  const [baseUrl, setBaseUrl] = useElectronStore('baseUrl', OPENAI_URL);
  const previousProviderRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false); // Add isInitialized state

  const getAvailableModels = useCallback(() => {
    if (pileAIProvider === 'gemini') {
      return [
        'gemini-2.5-pro-preview-06-05',
        'gemini-2.5-flash-preview-05-20',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
      ];
    }
    // Add other providers if they have a fixed list of models
    return []; // Return empty for openai and ollama where models can be custom
  }, [pileAIProvider]);

  const isModelMatchingProvider = useCallback((modelToCheck, provider) => {
    return (
      (provider === 'gemini' && modelToCheck.startsWith('gemini-')) ||
      (provider === 'openai' &&
        (modelToCheck.startsWith('gpt-') || modelToCheck.startsWith('o1-'))) ||
      (provider === 'ollama' &&
        !modelToCheck.startsWith('gemini-') &&
        !modelToCheck.startsWith('gpt-') &&
        !modelToCheck.startsWith('o1-'))
    );
  }, []);

  // Initialize after both provider and model are loaded
  useEffect(() => {
    if (!isInitialized && pileAIProvider && model) {
      setIsInitialized(true);
      previousProviderRef.current = pileAIProvider;
    }
  }, [pileAIProvider, model, isInitialized]);

  useEffect(() => {
    const newBaseUrl = getProviderBaseUrl(pileAIProvider);
    if (newBaseUrl) {
      setBaseUrl(newBaseUrl);
    }

    // Only change model when provider changes after initialization
    if (isInitialized && previousProviderRef.current !== pileAIProvider) {
      // If the current model doesn't match the new provider, set the default model
      if (!isModelMatchingProvider(model, pileAIProvider)) {
        setModel(getDefaultModel(pileAIProvider));
      }
      previousProviderRef.current = pileAIProvider;
    }
  }, [
    pileAIProvider,
    model,
    isInitialized,
    setBaseUrl,
    setModel,
    isModelMatchingProvider,
  ]);

  const setupAi = useCallback(async () => {
    const key = await window.electron.ipc.invoke('get-ai-key');
    if (!key && pileAIProvider !== 'ollama') return;

    // AI instances are now handled in the main process
    setAi({ type: pileAIProvider });
  }, [pileAIProvider]);

  useEffect(() => {
    if (currentPile) {
      // console.log('🧠 Syncing current pile');
      if (currentPile.AIPrompt) {
        setPrompt(currentPile.AIPrompt);
      }
      setupAi();
    }
  }, [currentPile, setupAi]);

  const generateCompletion = useCallback(
    async (context, callback) => {
      if (!ai) return;

      try {
        // Use streaming API for real-time responses
        const result = await window.electron.ipc.invoke(
          'ai-generate-completion-stream',
          {
            provider: ai.type,
            model,
            messages: context,
            maxTokens: 500,
          },
        );

        if (!result.success) {
          throw new Error(result.error || 'AI request failed');
        }

        const { requestId } = result;

        // Listen for streaming chunks
        const handleChunk = (chunk) => {
          callback(chunk);
        };

        const handleComplete = () => {
          chunkUnsubscribe();
          completeUnsubscribe();
          errorUnsubscribe();
        };

        const handleError = (error) => {
          chunkUnsubscribe();
          completeUnsubscribe();
          errorUnsubscribe();
          throw new Error(error);
        };

        // Set up event listeners
        const chunkUnsubscribe = window.electron.ipc.on(
          `ai-stream-chunk-${requestId}`,
          (chunk) => handleChunk(chunk),
        );
        const completeUnsubscribe = window.electron.ipc.on(
          `ai-stream-complete-${requestId}`,
          handleComplete,
        );
        const errorUnsubscribe = window.electron.ipc.on(
          `ai-stream-error-${requestId}`,
          (error) => handleError(error),
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('AI request failed:', error);
        // Make sure to clean up any pending listeners
        const chunkChannel = `ai-stream-chunk-${Date.now()}`;
        const completeChannel = `ai-stream-complete-${Date.now()}`;
        const errorChannel = `ai-stream-error-${Date.now()}`;

        // Remove any potential lingering listeners
        window.electron.ipc.removeAllListeners(chunkChannel);
        window.electron.ipc.removeAllListeners(completeChannel);
        window.electron.ipc.removeAllListeners(errorChannel);

        throw error;
      }
    },
    [ai, model],
  );

  const prepareCompletionContext = useCallback(
    (thread) => {
      // console.log(
      //   '📝 Preparing completion context with prompt:',
      //   prompt.substring(0, 100) + '...',
      // );
      // console.log('🧵 Thread data:', thread);

      const context = [
        { role: 'system', content: prompt },
        ...thread.map((post) => {
          const plainTextContent = htmlToText(post.content);
          return { role: 'user', content: plainTextContent };
        }),
      ];

      // console.log('📨 Final context being sent to AI:', context);
      return context;
    },
    [prompt],
  );

  const checkApiKeyValidity = useCallback(async () => {
    // TODO: Add regex for OpenAPI and Ollama API keys
    const key = await window.electron.ipc.invoke('get-ai-key');

    if (key !== null) {
      return true;
    }

    return false;
  }, []);

  const AIContextValue = useMemo(
    () => ({
      ai,
      baseUrl,
      setBaseUrl,
      prompt,
      setPrompt,
      getAvailableModels,
      setKey: (secretKey) =>
        window.electron.ipc.invoke('set-ai-key', secretKey),
      getKey: () => window.electron.ipc.invoke('get-ai-key'),
      validKey: checkApiKeyValidity,
      deleteKey: () => window.electron.ipc.invoke('delete-ai-key'),
      updateSettings: (newPrompt) => {
        return updateCurrentPile({ ...currentPile, AIPrompt: newPrompt });
      },
      model,
      setModel,
      embeddingModel,
      setEmbeddingModel,
      generateCompletion,
      prepareCompletionContext,
      pileAIProvider,
      setPileAIProvider,
    }),
    [
      ai,
      baseUrl,
      setBaseUrl,
      prompt,
      setPrompt,
      getAvailableModels,
      checkApiKeyValidity,
      updateCurrentPile,
      currentPile,
      model,
      setModel,
      embeddingModel,
      setEmbeddingModel,
      generateCompletion,
      prepareCompletionContext,
      pileAIProvider,
      setPileAIProvider,
    ],
  );

  return (
    <AIContext.Provider value={AIContextValue}>{children}</AIContext.Provider>
  );
}

AIContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAIContext = () => useContext(AIContext);
