/* eslint-disable jsx-a11y/label-has-associated-control */
import * as Tabs from '@radix-ui/react-tabs';
import { useCallback, useEffect, useState } from 'react';
import { useAIContext } from 'renderer/context/AIContext';
import { BoxOpenIcon, CardIcon, GeminiIcon, OllamaIcon } from 'renderer/icons';
import PropTypes from 'prop-types';
import styles from './AISettingTabs.module.scss';

export default function AISettingTabs({ APIkey, setCurrentKey }) {
  const {
    setBaseUrl,
    model,
    setModel,
    embeddingModel,
    setEmbeddingModel,
    baseUrl,
    pileAIProvider,
    setPileAIProvider,
  } = useAIContext();
  // Local state for inputs with debounced updates
  const [localModel, setLocalModel] = useState(model);
  const [localEmbeddingModel, setLocalEmbeddingModel] =
    useState(embeddingModel);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);

  // Debounce timers
  const [modelTimer, setModelTimer] = useState(null);
  const [embeddingTimer, setEmbeddingTimer] = useState(null);
  const [baseUrlTimer, setBaseUrlTimer] = useState(null);

  // Update local state when context values change (e.g., switching tabs)
  useEffect(() => {
    setLocalModel(model);
  }, [model]);

  useEffect(() => {
    setLocalEmbeddingModel(embeddingModel);
  }, [embeddingModel]);

  useEffect(() => {
    setLocalBaseUrl(baseUrl);
  }, [baseUrl]);

  // Debounced update functions
  const debouncedSetModel = useCallback(
    (value) => {
      if (modelTimer) clearTimeout(modelTimer);
      const timer = setTimeout(() => setModel(value), 800);
      setModelTimer(timer);
    },
    [modelTimer, setModel],
  );

  const debouncedSetEmbeddingModel = useCallback(
    (value) => {
      if (embeddingTimer) clearTimeout(embeddingTimer);
      const timer = setTimeout(() => setEmbeddingModel(value), 800);
      setEmbeddingTimer(timer);
    },
    [embeddingTimer, setEmbeddingModel],
  );

  const debouncedSetBaseUrl = useCallback(
    (value) => {
      if (baseUrlTimer) clearTimeout(baseUrlTimer);
      const timer = setTimeout(() => setBaseUrl(value), 800);
      setBaseUrlTimer(timer);
    },
    [baseUrlTimer, setBaseUrl],
  );

  const handleTabChange = (newValue) => {
    // Immediately commit any pending changes when switching tabs
    if (modelTimer) {
      clearTimeout(modelTimer);
      setModel(localModel);
    }
    if (embeddingTimer) {
      clearTimeout(embeddingTimer);
      setEmbeddingModel(localEmbeddingModel);
    }
    if (baseUrlTimer) {
      clearTimeout(baseUrlTimer);
      setBaseUrl(localBaseUrl);
    }
    setPileAIProvider(newValue);
  };

  const handleInputChange = (setter, debouncedSetter) => (e) => {
    const { value } = e.target;
    setter(value);
    if (debouncedSetter) {
      debouncedSetter(value);
    }
  };

  return (
    <Tabs.Root
      className={styles.tabsRoot}
      defaultValue="openai"
      value={pileAIProvider}
      onValueChange={handleTabChange}
    >
      <Tabs.List className={styles.tabsList} aria-label="Manage your account">
        <Tabs.Trigger className={styles.tabsTrigger} value="subscription">
          Subscription
          <CardIcon className={styles.icon} />
        </Tabs.Trigger>
        <Tabs.Trigger className={styles.tabsTrigger} value="ollama">
          Ollama API
          <OllamaIcon className={styles.icon} />
        </Tabs.Trigger>
        <Tabs.Trigger className={styles.tabsTrigger} value="openai">
          OpenAI API
          <BoxOpenIcon className={styles.icon} />
        </Tabs.Trigger>
        <Tabs.Trigger className={styles.tabsTrigger} value="gemini">
          Gemini API
          <GeminiIcon className={styles.icon} />
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content className={styles.tabsContent} value="subscription">
        <div className={styles.providers}>
          <div className={styles.pitch}>
            One simple subscription to use best-in-class AI with Pile, and
            support the project.
          </div>
          <div>
            <div className={styles.pro}>
              <div className={styles.left}>
                <div className={styles.price}>$9/month</div>
              </div>
              <div className={styles.right}>
                <div className={styles.subscribe}>Coming soon!</div>
              </div>
            </div>
            <div className={styles.disclaimer}>
              AI subscription for Pile is provided separately by{' '}
              <a href="https://un.ms" target="_blank" rel="noopener noreferrer">
                UNMS
              </a>
              . Subject to availability and capacity limits. Fair-use policy
              applies.
            </div>
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content className={styles.tabsContent} value="ollama">
        <div className={styles.providers}>
          <div className={styles.pitch}>
            Setup Ollama and set your preferred models here to use your local AI
            in Pile.
          </div>

          <div className={styles.group}>
            <fieldset className={styles.fieldset}>
              <label className={styles.label} htmlFor="ollama-model">
                Model
              </label>
              <input
                id="ollama-model"
                className={styles.input}
                onChange={handleInputChange(setLocalModel, debouncedSetModel)}
                value={localModel}
                placeholder="llama3.1:70b"
              />
            </fieldset>
            <fieldset className={styles.fieldset}>
              <label className={styles.label} htmlFor="ollama-embedding-model">
                Embedding model
              </label>
              <input
                id="ollama-embedding-model"
                className={styles.input}
                onChange={handleInputChange(
                  setLocalEmbeddingModel,
                  debouncedSetEmbeddingModel,
                )}
                value={localEmbeddingModel}
                placeholder="mxbai-embed-large"
              />
            </fieldset>
          </div>

          <div className={styles.disclaimer}>
            Ollama is the easiest way to run AI models on your own computer.
            Remember to pull your models in Ollama before using them in Pile.
            Learn more and download Ollama from{' '}
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              ollama.com
            </a>
            .
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content className={styles.tabsContent} value="openai">
        <div className={styles.providers}>
          <div className={styles.pitch}>
            Create an API key in your OpenAI account and paste it here to start
            using GPT AI models in Pile.
          </div>

          <div className={styles.group}>
            <fieldset className={styles.fieldset}>
              <label className={styles.label} htmlFor="openai-base-url">
                Base URL
              </label>
              <input
                id="openai-base-url"
                className={styles.input}
                onChange={handleInputChange(
                  setLocalBaseUrl,
                  debouncedSetBaseUrl,
                )}
                value={localBaseUrl}
                placeholder="https://api.openai.com/v1"
              />
            </fieldset>
            <fieldset className={styles.fieldset}>
              <label className={styles.label} htmlFor="openai-model">
                Model
              </label>
              <input
                id="openai-model"
                className={styles.input}
                onChange={handleInputChange(setLocalModel, debouncedSetModel)}
                value={localModel}
                placeholder="gpt-4o"
              />
            </fieldset>
          </div>
          <div className={styles.disclaimer}>
            Remember to manage your spend by setting up a budget in the API
            service you choose to use.
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content className={styles.tabsContent} value="gemini">
        <div className={styles.providers}>
          <div className={styles.pitch}>
            Create an API key in Google AI Studio and paste it here to start
            using Gemini AI models in Pile.
          </div>
          <div className={styles.group}>
            <fieldset className={styles.fieldset}>
              <label className={styles.label} htmlFor="gemini-model">
                Model
              </label>
              <input
                id="gemini-model"
                className={styles.input}
                onChange={handleInputChange(setLocalModel, debouncedSetModel)}
                value={localModel}
                placeholder="gemini-2.5-flash"
              />
            </fieldset>
            <fieldset className={styles.fieldset}>
              <label className={styles.label} htmlFor="gemini-api-key">
                Gemini API key
              </label>
              <input
                id="gemini-api-key"
                className={styles.input}
                onChange={handleInputChange(setCurrentKey)}
                value={APIkey}
                placeholder="Paste a Gemini API key to enable AI reflections"
              />
            </fieldset>
          </div>
          <div className={styles.disclaimer}>
            Remember to manage your spend by setting up a budget in the API
            service you choose to use.
          </div>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}

AISettingTabs.propTypes = {
  APIkey: PropTypes.string.isRequired,
  setCurrentKey: PropTypes.func.isRequired,
};
