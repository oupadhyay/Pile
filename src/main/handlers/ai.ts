/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { ipcMain, BrowserWindow } from 'electron';
import OpenAI from 'openai';
import { getKey } from '../utils/store';

const OLLAMA_URL = 'http://localhost:11434/api';
const OPENAI_URL = 'https://api.openai.com/v1';
const GEMINI_OPENAI_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/';

const getProviderBaseUrl = (provider: string) => {
  if (provider === 'openai') return OPENAI_URL;
  if (provider === 'gemini') return GEMINI_OPENAI_URL;
  return null;
};

ipcMain.handle(
  'ai-generate-completion',
  async (_, { provider, model, messages, maxTokens = 500 }) => {
    try {
      if (provider === 'ollama') {
        const response = await fetch(`${OLLAMA_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        const decoder = new TextDecoder();
        const chunks: string[] = [];

        let done = false;
        while (!done) {
          const { value, done: readDone } = await reader.read();
          done = readDone;
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            lines.forEach((line) => {
              const trimmedLine = line.trim();
              if (trimmedLine !== '') {
                try {
                  const jsonResponse = JSON.parse(trimmedLine);
                  if (!jsonResponse.done && jsonResponse.message?.content) {
                    chunks.push(jsonResponse.message.content);
                  }
                } catch (parseError) {
                  // It's okay for Ollama to return non-JSON lines, so we just ignore parse errors
                  // console.warn('Failed to parse JSON line:', line);
                }
              }
            });
          }
        }

        return { success: true, content: chunks.join('') };
      }
      if (provider === 'gemini' || provider === 'openai') {
        const apiKey = await getKey();
        if (!apiKey) {
          throw new Error('API key not found');
        }

        const baseURL = getProviderBaseUrl(provider);
        if (!baseURL) {
          throw new Error(`Unknown provider: ${provider}`);
        }

        const openai = new OpenAI({
          apiKey,
          baseURL,
        });

        const stream = await openai.chat.completions.create({
          model,
          stream: true,
          max_tokens: maxTokens,
          messages,
        });

        const chunks: string[] = [];
        for await (const part of stream) {
          if (part.choices[0]?.delta?.content) {
            chunks.push(part.choices[0].delta.content);
          }
        }

        return { success: true, content: chunks.join('') };
      }
      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      console.error('AI request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);

ipcMain.handle(
  'ai-generate-completion-stream',
  async (_, { provider, model, messages, maxTokens = 500 }) => {
    // For streaming, we'll return a unique request ID and use a separate channel for chunks
    const requestId = Date.now().toString();

    try {
      if (provider === 'ollama') {
        const response = await fetch(`${OLLAMA_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        const decoder = new TextDecoder();

        // Process stream in background
        (async () => {
          try {
            let done = false;
            while (!done) {
              const { value, done: readDone } = await reader.read();
              done = readDone;

              if (value) {
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                lines.forEach((line) => {
                  if (line.trim() !== '') {
                    try {
                      const jsonResponse = JSON.parse(line);
                      if (!jsonResponse.done && jsonResponse.message?.content) {
                        // Send chunk to renderer
                        const mainWindow =
                          BrowserWindow.getFocusedWindow() ||
                          BrowserWindow.getAllWindows()[0];
                        if (mainWindow) {
                          mainWindow.webContents.send(
                            `ai-stream-chunk-${requestId}`,
                            jsonResponse.message.content,
                          );
                        }
                      }
                    } catch (parseError) {
                      // It's okay for Ollama to return non-JSON lines, so we just ignore parse errors
                      // console.warn('Failed to parse JSON line:', line);
                    }
                  }
                });
              }
            }

            // Send completion signal
            const mainWindow =
              BrowserWindow.getFocusedWindow() ||
              BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
              mainWindow.webContents.send(`ai-stream-complete-${requestId}`);
            }
          } catch (error) {
            const mainWindow =
              BrowserWindow.getFocusedWindow() ||
              BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
              mainWindow.webContents.send(
                `ai-stream-error-${requestId}`,
                error instanceof Error ? error.message : 'Unknown error',
              );
            }
          }
        })();

        return { success: true, requestId };
      }
      if (provider === 'gemini' || provider === 'openai') {
        const apiKey = await getKey();
        if (!apiKey) {
          throw new Error('API key not found');
        }

        const baseURL = getProviderBaseUrl(provider);
        if (!baseURL) {
          throw new Error(`Unknown provider: ${provider}`);
        }

        const openai = new OpenAI({
          apiKey,
          baseURL,
        });

        // Process stream in background
        (async () => {
          try {
            const stream = await openai.chat.completions.create({
              model,
              stream: true,
              max_tokens: maxTokens,
              messages,
            });

            for await (const part of stream) {
              if (part.choices[0]?.delta?.content) {
                // Send chunk to renderer
                const mainWindow =
                  BrowserWindow.getFocusedWindow() ||
                  BrowserWindow.getAllWindows()[0];
                if (mainWindow) {
                  mainWindow.webContents.send(
                    `ai-stream-chunk-${requestId}`,
                    part.choices[0].delta.content,
                  );
                }
              }
            }

            // Send completion signal
            const mainWindow =
              BrowserWindow.getFocusedWindow() ||
              BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
              mainWindow.webContents.send(`ai-stream-complete-${requestId}`);
            }
          } catch (error) {
            const mainWindow =
              BrowserWindow.getFocusedWindow() ||
              BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
              mainWindow.webContents.send(
                `ai-stream-error-${requestId}`,
                error instanceof Error ? error.message : 'Unknown error',
              );
            }
          }
        })();

        return { success: true, requestId };
      }
      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      console.error('AI stream request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);
