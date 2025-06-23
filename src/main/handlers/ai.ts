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

const isGeminiModel = (model: string): boolean => {
  const isGemini = model.startsWith('gemini-');
  return isGemini;
};

ipcMain.handle(
  'ai-generate-completion',
  async (_, { provider, model, messages }) => {
    try {
      if (provider === 'ollama') {
        const response = await fetch(`${OLLAMA_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, stream: false }),
        });

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => 'No error details');
          throw new Error(
            `HTTP error! status: ${response.status} - ${errorText}`,
          );
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

        let stream;
        try {
          const completionParams: any = {
            model,
            stream: true,
            messages,
            max_tokens: 500,
          };

          // Add reasoning_effort: none for Gemini models to disable thinking
          if (isGeminiModel(model)) {
            // console.warn(`Disabling thinking for Gemini model: ${model}`);
            completionParams.reasoning_effort = 'none';
          }

          stream = await openai.chat.completions.create(completionParams);
        } catch (apiError: any) {
          throw new Error(
            `API Error (${apiError.status}): ${apiError.message || 'Unknown error'}`,
          );
        }

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
      // eslint-disable-next-line no-console
      console.error('AI request failed:', error);
      // Check if it's a network error that might indicate Ollama is not running
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          error:
            'Unable to connect to AI service. Please ensure Ollama is running if using Ollama provider.',
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);

ipcMain.handle(
  'ai-generate-completion-stream',
  async (_, { provider, model, messages }) => {
    // For streaming, we'll return a unique request ID and use a separate channel for chunks
    const requestId = Date.now().toString();

    try {
      if (provider === 'ollama') {
        const response = await fetch(`${OLLAMA_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, stream: true }),
        });

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => 'No error details');
          throw new Error(
            `HTTP error! status: ${response.status} - ${errorText}`,
          );
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
            let stream;
            try {
              const completionParams: any = {
                model,
                stream: true,
                messages,
                max_tokens: 500,
              };

              // Add reasoning_effort: none for Gemini models to disable thinking
              if (isGeminiModel(model)) {
                // Disabling thinking for Gemini streaming model
                completionParams.reasoning_effort = 'none';
              }

              stream = await openai.chat.completions.create(completionParams);
            } catch (apiError: any) {
              // eslint-disable-next-line no-console
              console.error('OpenAI/Gemini streaming API error:', apiError);
              let errorMessage = 'AI request failed';
              if (apiError.status === 404) {
                errorMessage = `Model "${model}" not found. Please check if the model name is correct.`;
              } else if (apiError.status === 401) {
                errorMessage =
                  'Invalid API key. Please check your API key configuration.';
              } else if (apiError.status === 429) {
                errorMessage = 'Rate limit exceeded. Please try again later.';
              } else if (apiError.status) {
                errorMessage = `API Error (${apiError.status}): ${apiError.message || 'Unknown error'}`;
              } else {
                errorMessage = apiError.message || 'Unknown error';
              }
              const mainWindow =
                BrowserWindow.getFocusedWindow() ||
                BrowserWindow.getAllWindows()[0];
              if (mainWindow) {
                mainWindow.webContents.send(
                  `ai-stream-error-${requestId}`,
                  errorMessage,
                );
              }
              return;
            }

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
            // eslint-disable-next-line no-console
            console.error('Streaming error:', error);
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
      // eslint-disable-next-line no-console
      console.error('AI stream request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);
