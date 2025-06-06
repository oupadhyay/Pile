import React from 'react';
import { render, act } from '@testing-library/react';
import { AIContextProvider, useAIContext } from '../renderer/context/AIContext';
import { usePilesContext } from '../renderer/context/PilesContext';
import { useElectronStore } from '../renderer/hooks/useElectronStore';

jest.mock('../renderer/context/PilesContext');
jest.mock('../renderer/hooks/useElectronStore');

const mockPilesContext = {
  currentPile: { id: '1', name: 'Test Pile' },
  updateCurrentPile: jest.fn(),
};

const mockElectronStore =
  (store = {}) =>
  (key, initialValue) => {
    const [state, setState] = React.useState(store[key] || initialValue);
    const setStore = (value) => {
      store[key] = value;
      setState(value);
    };
    return [state, setStore];
  };

describe('AIContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.electron = {
      ipc: {
        invoke: jest.fn().mockResolvedValue('test-key'),
        on: jest.fn().mockReturnValue(() => {}),
      },
    };
    usePilesContext.mockReturnValue(mockPilesContext);
  });

  it('initializes with default OpenAI settings', async () => {
    useElectronStore.mockImplementation(
      mockElectronStore({
        pileAIProvider: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
      }),
    );

    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }

    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });

    expect(context.pileAIProvider).toBe('openai');
    expect(context.model).toBe('gpt-4o');
    expect(context.baseUrl).toBe('https://api.openai.com/v1');
    expect(context.ai.type).toBe('openai');
  });

  it('initializes with gemini provider and correct settings', async () => {
    useElectronStore.mockImplementation(
      mockElectronStore({
        pileAIProvider: 'gemini',
        model: 'gemini-2.5-flash', // Include the expected model in the store
        baseUrl: 'https://api.openai.com/v1',
      }),
    );

    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }

    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });

    expect(context.pileAIProvider).toBe('gemini');
    expect(context.model).toBe('gemini-2.5-flash');
    // baseUrl should remain as the stored value since getProviderBaseUrl returns null for gemini
    expect(context.baseUrl).toBe('https://api.openai.com/v1');
    expect(context.ai.type).toBe('gemini');
  });

  it('switches to gemini provider and updates settings', async () => {
    const store = { pileAIProvider: 'openai' };
    useElectronStore.mockImplementation(mockElectronStore(store));

    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }

    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });

    expect(context.pileAIProvider).toBe('openai');

    await act(async () => {
      context.setPileAIProvider('gemini');
    });

    expect(context.pileAIProvider).toBe('gemini');
    expect(context.model).toBe('gemini-2.5-flash');
  });

  it('provides available models for gemini', async () => {
    useElectronStore.mockImplementation(
      mockElectronStore({
        pileAIProvider: 'gemini',
      }),
    );
    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }
    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });
    expect(context.getAvailableModels()).toEqual([
      'gemini-2.5-flash',
      'gemini-2.0-pro',
      'gemini-2.0-flash',
    ]);
  });

  it('provides empty array for openai models', async () => {
    useElectronStore.mockImplementation(
      mockElectronStore({
        pileAIProvider: 'openai',
      }),
    );
    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }
    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });
    expect(context.getAvailableModels()).toEqual([]);
  });

  it('provides empty array for ollama models', async () => {
    useElectronStore.mockImplementation(
      mockElectronStore({
        pileAIProvider: 'ollama',
      }),
    );
    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }
    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });
    expect(context.getAvailableModels()).toEqual([]);
  });

  it('getAvailableModels is memoized correctly', async () => {
    useElectronStore.mockImplementation(
      mockElectronStore({
        pileAIProvider: 'gemini',
      }),
    );
    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }
    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });

    const firstCall = context.getAvailableModels;

    // Force a re-render
    await act(async () => {
      context.setPrompt('new prompt');
    });

    const secondCall = context.getAvailableModels;
    // Function should be the same reference since pileAIProvider didn't change
    expect(firstCall).toBe(secondCall);
  });

  it('checkApiKeyValidity returns true when key exists', async () => {
    window.electron.ipc.invoke.mockResolvedValue('test-key');

    useElectronStore.mockImplementation(
      mockElectronStore({
        pileAIProvider: 'openai',
      }),
    );

    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }

    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });

    const isValid = await context.validKey();
    expect(isValid).toBe(true);
  });

  it('checkApiKeyValidity returns false when key is null', async () => {
    window.electron.ipc.invoke.mockResolvedValue(null);

    useElectronStore.mockImplementation(
      mockElectronStore({
        pileAIProvider: 'openai',
      }),
    );

    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }

    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });

    const isValid = await context.validKey();
    expect(isValid).toBe(false);
  });

  it('loads AI prompt from current pile', async () => {
    const mockPilesContextWithPrompt = {
      currentPile: { id: '1', name: 'Test Pile', AIPrompt: 'Custom AI prompt' },
      updateCurrentPile: jest.fn(),
    };

    usePilesContext.mockReturnValue(mockPilesContextWithPrompt);
    useElectronStore.mockImplementation(mockElectronStore({}));

    let context;
    function TestComponent() {
      context = useAIContext();
      return null;
    }

    await act(async () => {
      render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
    });

    expect(context.prompt).toBe('Custom AI prompt');
  });

  it('memoizes context value when dependencies do not change', async () => {
    const store = {
      pileAIProvider: 'openai',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      embeddingModel: 'mxbai-embed-large',
    };
    useElectronStore.mockImplementation(mockElectronStore(store));

    let renderCount = 0;
    const contexts = [];

    function TestComponent() {
      const ctx = useAIContext();
      contexts[renderCount] = ctx;
      renderCount += 1;
      return null;
    }

    // Initial render and wait for async effects to complete
    const { rerender } = await act(async () => {
      const result = render(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
      // Wait a bit for setupAi async function to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      return result;
    });

    // Second render without changing any dependencies
    await act(async () => {
      rerender(
        <AIContextProvider>
          <TestComponent />
        </AIContextProvider>,
      );
      // Wait again for any async effects
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    // Since the ai state changes asynchronously, we'll test that the functions are memoized
    expect(contexts[0]).toBeDefined();
    expect(contexts[1]).toBeDefined();

    // Test that specific memoized functions are the same reference
    // Only test functions that don't depend on changing state (ai, model)
    expect(contexts[0].getAvailableModels).toBe(contexts[1].getAvailableModels);
    expect(contexts[0].validKey).toBe(contexts[1].validKey);
    expect(contexts[0].prepareCompletionContext).toBe(
      contexts[1].prepareCompletionContext,
    );
    // generateCompletion depends on ai/model state that changes, so we don't test it
  });
});
