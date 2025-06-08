import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../renderer/App';
import { usePilesContext } from '../renderer/context/PilesContext';
import { useElectronStore } from '../renderer/hooks/useElectronStore';
import React from 'react';

// Mock all required contexts and hooks
jest.mock('../renderer/context/PilesContext');
jest.mock('../renderer/hooks/useElectronStore');
jest.mock('../renderer/context/AIContext', () => ({
  AIContextProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAIContext: () => ({
    ai: null,
    prompt: 'Default prompt',
    model: 'gpt-4o',
    pileAIProvider: 'openai',
  }),
}));
jest.mock('../renderer/context/ToastsContext', () => ({
  ToastsContextProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useToastsContext: () => ({
    notifications: [],
    addNotification: jest.fn(),
    removeNotification: jest.fn(),
  }),
}));

const mockUsePilesContext = usePilesContext as jest.MockedFunction<typeof usePilesContext>;
const mockUseElectronStore = useElectronStore as jest.MockedFunction<typeof useElectronStore>;

describe('App', () => {
  beforeEach(() => {
    // Mock window.electron
    Object.defineProperty(window, 'electron', {
      value: {
        isMac: true,
        ipc: {
          invoke: jest.fn().mockResolvedValue(null),
          on: jest.fn().mockReturnValue(() => {}),
          removeListener: jest.fn(),
        },
        getConfigPath: jest.fn().mockReturnValue('/mock/config/path'),
        existsSync: jest.fn().mockReturnValue(true),
      },
      writable: true,
    });

    // Mock PilesContext
    mockUsePilesContext.mockReturnValue({
      currentPile: { 
        id: '1', 
        name: 'Test Pile',
        path: '/test/pile/path',
        AIPrompt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      updateCurrentPile: jest.fn(),
      piles: [],
      loadPiles: jest.fn(),
      createPile: jest.fn(),
      deletePile: jest.fn(),
      isLoading: false,
      error: null,
    });

    // Mock useElectronStore
    mockUseElectronStore.mockImplementation((key: string, defaultValue: any) => {
      const mockStore: Record<string, any> = {
        pileAIProvider: 'openai',
        model: 'gpt-4o',
        embeddingModel: 'mxbai-embed-large',
        baseUrl: 'https://api.openai.com/v1',
      };
      
      const [state, setState] = React.useState(mockStore[key] || defaultValue);
      return [state, setState];
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    
    expect(container).toBeInTheDocument();
  });

  it('renders with different routes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/pile/test-pile']}>
        <App />
      </MemoryRouter>
    );
    
    expect(container).toBeInTheDocument();
  });

  it('handles missing currentPile gracefully', () => {
    mockUsePilesContext.mockReturnValue({
      currentPile: null,
      updateCurrentPile: jest.fn(),
      piles: [],
      loadPiles: jest.fn(),
      createPile: jest.fn(),
      deletePile: jest.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    
    expect(container).toBeInTheDocument();
  });

  it('handles error state in PilesContext', () => {
    mockUsePilesContext.mockReturnValue({
      currentPile: null,
      updateCurrentPile: jest.fn(),
      piles: [],
      loadPiles: jest.fn(),
      createPile: jest.fn(),
      deletePile: jest.fn(),
      isLoading: false,
      error: 'Failed to load piles',
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    
    expect(container).toBeInTheDocument();
  });

  it('handles loading state in PilesContext', () => {
    mockUsePilesContext.mockReturnValue({
      currentPile: null,
      updateCurrentPile: jest.fn(),
      piles: [],
      loadPiles: jest.fn(),
      createPile: jest.fn(),
      deletePile: jest.fn(),
      isLoading: true,
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    
    expect(container).toBeInTheDocument();
  });
});