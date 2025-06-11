/* eslint-disable jsx-a11y/label-has-associated-control */
import * as Tabs from '@radix-ui/react-tabs';
import { useCallback, useEffect, useState } from 'react';
import { useAIContext } from 'renderer/context/AIContext';
import { BoxOpenIcon, CardIcon, OllamaIcon } from 'renderer/icons';
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
    getAvailableModels,
  } = useAIContext();

  // Local state for inputs with debounced updates
  const [localModel, setLocalModel] = useState(model);
  const [localEmbeddingModel, setLocalEmbeddingModel] =
    useState(embeddingModel);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);
  const [remoteProvider, setRemoteProvider] = useState(
    pileAIProvider === 'gemini' ? 'gemini' : 'openai',
  );

  // Remember model for each provider
  const [providerModels, setProviderModels] = useState({
    openai: model,
    gemini: model,
  });

  // Debounce timers
  const [modelTimer, setModelTimer] = useState(null);
  const [embeddingTimer, setEmbeddingTimer] = useState(null);
  const [baseUrlTimer, setBaseUrlTimer] = useState(null);

  // Update local state when context values change (e.g., switching tabs)
  useEffect(() => {
    setLocalModel(model);
    setProviderModels((prev) => ({
      ...prev,
      [pileAIProvider]: model,
    }));
  }, [model, pileAIProvider]);

  useEffect(() => {
    setLocalEmbeddingModel(embeddingModel);
  }, [embeddingModel]);

  useEffect(() => {
    setLocalBaseUrl(baseUrl);
  }, [baseUrl]);

  // Sync remoteProvider with pileAIProvider
  useEffect(() => {
    if (pileAIProvider === 'gemini') {
      setRemoteProvider('gemini');
    } else if (pileAIProvider === 'openai') {
      setRemoteProvider('openai');
    }
  }, [pileAIProvider]);

  // Debounced update functions
  const debouncedSetModel = useCallback(
    (value) => {
      if (modelTimer) clearTimeout(modelTimer);
      const timer = setTimeout(() => {
        setModel(value);
        setProviderModels((prev) => ({
          ...prev,
          [remoteProvider]: value,
        }));
      }, 800);
      setModelTimer(timer);
    },
    [modelTimer, setModel, remoteProvider],
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
    // Map 'remote' to the selected provider for backward compatibility with existing context
    const mappedValue = newValue === 'remote' ? remoteProvider : newValue;
    setPileAIProvider(mappedValue);
  };

  const handleInputChange = (setter, debouncedSetter) => (e) => {
    const { value } = e.target;
    setter(value);
    if (debouncedSetter) {
      debouncedSetter(value);
    }
  };

  const getProviderConfig = () => {
    const configs = {
      openai: {
        name: 'OpenAI',
        baseUrlPlaceholder: 'https://api.openai.com/v1',
        modelPlaceholder: 'gpt-4o',
        keyPlaceholder: 'Paste an OpenAI API key to enable AI reflections',
        keyLabel: 'OpenAI API key',
        disclaimer:
          'Remember to manage your spend by setting up a budget in the API service you choose to use.',
        pitch:
          'Create an API key in your OpenAI account and paste it here to start using GPT AI models in Pile.',
      },
      gemini: {
        name: 'Gemini',
        baseUrlPlaceholder:
          'https://generativelanguage.googleapis.com/v1beta/openai/',
        modelPlaceholder: 'gemini-2.0-flash',
        keyPlaceholder: 'Paste a Gemini API key to enable AI reflections',
        keyLabel: 'Gemini API key',
        disclaimer:
          'Remember to manage your spend by setting up a budget in the API service you choose to use.',
        pitch:
          'Create an API key in Google AI Studio and paste it here to start using Gemini AI models in Pile.',
        availableModels: getAvailableModels(),
      },
    };
    return configs[remoteProvider] || configs.openai;
  };

  const currentConfig = getProviderConfig();

  return (
    <Tabs.Root
      className={styles.tabsRoot}
      value={
        pileAIProvider === 'openai' || pileAIProvider === 'gemini'
          ? 'remote'
          : pileAIProvider
      }
      onValueChange={handleTabChange}
    >
      <Tabs.List className={styles.tabsList} aria-label="Manage your account">
        <Tabs.Trigger
          className={`${styles.tabsTrigger} ${
            pileAIProvider === 'ollama' ? styles.activeCenter : ''
          } ${pileAIProvider === 'openai' || pileAIProvider === 'gemini' ? styles.activeRight : ''}`}
          value="subscription"
        >
          Subscription
          <CardIcon className={styles.icon} />
        </Tabs.Trigger>
        <Tabs.Trigger
          className={`${styles.tabsTrigger} ${
            pileAIProvider === 'subscription' ? styles.activeLeft : ''
          } ${pileAIProvider === 'openai' || pileAIProvider === 'gemini' ? styles.activeRight : ''}`}
          value="ollama"
        >
          Ollama
          <OllamaIcon className={styles.icon} />
        </Tabs.Trigger>
        <Tabs.Trigger
          className={`${styles.tabsTrigger} ${
            pileAIProvider === 'ollama' ? styles.activeCenter : ''
          } ${pileAIProvider === 'subscription' ? styles.activeLeft : ''}`}
          value="remote"
        >
          Remote AI
          <BoxOpenIcon className={styles.icon} />
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

      <Tabs.Content className={styles.tabsContent} value="remote">
        <div className={styles.providers}>
          <div className={styles.pitch}>{currentConfig.pitch}</div>

          <fieldset className={styles.fieldset}>
            <label className={styles.label} htmlFor="remote-provider">
              Provider
            </label>
            <select
              id="remote-provider"
              className={styles.input}
              value={remoteProvider}
              onChange={(e) => {
                const newProvider = e.target.value;
                setRemoteProvider(newProvider);
                setPileAIProvider(newProvider);

                // Update base URL but keep the model that was previously set for this provider
                const newBaseUrl =
                  {
                    openai: 'https://api.openai.com/v1',
                    gemini:
                      'https://generativelanguage.googleapis.com/v1beta/openai/',
                  }[newProvider] || 'https://api.openai.com/v1';

                const rememberedModel =
                  providerModels[newProvider] ||
                  {
                    openai: 'gpt-4o',
                    gemini: 'gemini-2.0-flash',
                  }[newProvider] ||
                  'gpt-4o';

                setLocalBaseUrl(newBaseUrl);
                setLocalModel(rememberedModel);

                // Immediately update the context as well
                setBaseUrl(newBaseUrl);
                setModel(rememberedModel);
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </fieldset>

          <div className={styles.group}>
            <fieldset className={styles.fieldset}>
              <label className={styles.label} htmlFor="remote-base-url">
                Base URL
              </label>
              <input
                id="remote-base-url"
                className={styles.input}
                onChange={handleInputChange(
                  setLocalBaseUrl,
                  debouncedSetBaseUrl,
                )}
                value={localBaseUrl}
                placeholder={currentConfig.baseUrlPlaceholder}
              />
            </fieldset>
            <fieldset className={styles.fieldset}>
              <label className={styles.label} htmlFor="remote-model">
                Model
              </label>
              {currentConfig.availableModels ? (
                <select
                  id="remote-model"
                  className={`${styles.input} ${styles.modelInput}`}
                  value={localModel}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    setLocalModel(newModel);
                    setModel(newModel);
                    setProviderModels((prev) => ({
                      ...prev,
                      [remoteProvider]: newModel,
                    }));
                  }}
                >
                  {currentConfig.availableModels.map((availableModel) => (
                    <option key={availableModel} value={availableModel}>
                      {availableModel}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="remote-model"
                  className={styles.input}
                  onChange={handleInputChange(setLocalModel, debouncedSetModel)}
                  value={localModel}
                  placeholder={currentConfig.modelPlaceholder}
                />
              )}
            </fieldset>
          </div>
          <fieldset className={styles.fieldset}>
            <label className={styles.label} htmlFor="remote-api-key">
              {currentConfig.keyLabel}
            </label>
            <input
              id="remote-api-key"
              className={styles.input}
              onChange={(e) => setCurrentKey(e.target.value)}
              value={APIkey}
              placeholder={currentConfig.keyPlaceholder}
            />
          </fieldset>
          <div className={styles.disclaimer}>{currentConfig.disclaimer}</div>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}

AISettingTabs.propTypes = {
  APIkey: PropTypes.string.isRequired,
  setCurrentKey: PropTypes.func.isRequired,
};
