/* eslint-disable no-underscore-dangle */
import 'jest-fetch-mock';
import '@testing-library/jest-dom';

// Mock window.electron globally for all tests
Object.defineProperty(window, 'electron', {
  value: {
    isMac: true,
    ipc: {
      invoke: jest.fn().mockResolvedValue(null),
      on: jest.fn().mockReturnValue(() => {}),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    getConfigPath: jest.fn().mockReturnValue('/mock/config/path'),
    existsSync: jest.fn().mockReturnValue(true),
  },
  writable: true,
});

// Mock document.createElement for tests that use it (like htmlToText in AIContext)
const originalCreateElement = document.createElement;
document.createElement = jest.fn().mockImplementation((tagName) => {
  const element = originalCreateElement.call(document, tagName);
  if (tagName === 'div') {
    Object.defineProperty(element, 'innerHTML', {
      get() {
        return this._innerHTML || '';
      },
      set(value) {
        this._innerHTML = value;
        // Simple text extraction for testing
        this.textContent = value.replace(/<[^>]*>/g, '');
        this.innerText = this.textContent;
      },
    });
  }
  return element;
});

// Mock React.useState for consistent testing
const originalUseState = require('react').useState;
jest.spyOn(require('react'), 'useState').mockImplementation((initial) => {
  return originalUseState(initial);
});

// Global test utilities
global.testUtils = {
  // Helper to create mock pile objects
  createMockPile: (overrides = {}) => ({
    id: '1',
    name: 'Test Pile',
    path: '/test/pile/path',
    AIPrompt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  // Helper to create mock post objects
  createMockPost: (overrides = {}) => ({
    id: '1',
    content: '<p>Test content</p>',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: {
      attachments: [],
    },
    ...overrides,
  }),
};

// Suppress console warnings for tests unless explicitly needed
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = jest.fn();
console.error = jest.fn();

// Restore console methods for specific tests that need them
global.restoreConsole = () => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
};

// Basic functionality test
describe('Jest Setup', () => {
  it('should have properly configured testing environment', () => {
    expect(window.electron).toBeDefined();
    expect(typeof window.electron.ipc.invoke).toBe('function');
    expect(global.testUtils).toBeDefined();
    expect(typeof global.testUtils.createMockPile).toBe('function');
    expect(typeof global.testUtils.createMockPost).toBe('function');
  });

  it('should have document.createElement properly mocked', () => {
    const div = document.createElement('div');
    div.innerHTML = '<span>Hello World</span>';
    expect(div.textContent).toBe('Hello World');
  });

  it('should have fetch mocked', () => {
    expect(fetch).toBeDefined();
    expect(typeof fetch).toBe('function');
  });
});
