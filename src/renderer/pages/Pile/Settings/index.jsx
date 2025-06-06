import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useAIContext } from 'renderer/context/AIContext';
import {
  availableThemes,
  usePilesContext,
} from 'renderer/context/PilesContext';
import { CrossIcon, SettingsIcon } from 'renderer/icons';
import AISettingTabs from './AISettingsTabs';
import styles from './Settings.module.scss';

export default function Settings() {
  const { prompt, setPrompt, updateSettings, getKey, setKey, deleteKey } =
    useAIContext();
  const [APIkey, setCurrentKey] = useState('');
  const { currentTheme, setTheme } = usePilesContext();

  const retrieveKey = async () => {
    const k = await getKey();
    setCurrentKey(k);
  };

  useEffect(() => {
    retrieveKey();
  });

  const handleOnChangePrompt = (e) => {
    const p = e.target.value ?? '';
    setPrompt(p);
  };

  const handleSaveChanges = () => {
    // eslint-disable-next-line eqeqeq
    if (!APIkey || APIkey == '') {
      deleteKey();
    } else {
      // console.log('save key', APIkey);
      setKey(APIkey);
    }

    updateSettings(prompt);
    // regenerateEmbeddings();
  };

  const renderThemes = () => {
    return Object.keys(availableThemes).map((theme) => {
      const colors = availableThemes[theme];
      return (
        <button
          key={`theme-${theme}`}
          type="button"
          className={`${styles.theme} ${
            currentTheme === theme && styles.current
          }`}
          onClick={() => {
            setTheme(theme);
          }}
          aria-label={`Change theme to ${theme}`}
        >
          <div
            className={styles.color1}
            style={{ background: colors.primary }}
          />
        </button>
      );
    });
  };
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <div className={styles.iconHolder}>
          <SettingsIcon className={styles.settingsIcon} />
        </div>
      </Dialog.Trigger>
      <Dialog.Portal container={document.getElementById('dialog')}>
        <Dialog.Overlay className={styles.DialogOverlay} />
        <Dialog.Content className={styles.DialogContent}>
          <Dialog.Title className={styles.DialogTitle}>Settings</Dialog.Title>
          <fieldset className={styles.Fieldset}>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className={styles.Label} htmlFor="appearance">
              Appearance
            </label>
            <div className={styles.themes}>{renderThemes()}</div>
          </fieldset>

          <fieldset className={styles.Fieldset}>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className={styles.Label} htmlFor="ai-provider">
              Select your AI provider
            </label>
            <AISettingTabs APIkey={APIkey} setCurrentKey={setCurrentKey} />
          </fieldset>

          <fieldset className={styles.Fieldset}>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className={styles.Label} htmlFor="ai-prompt">
              AI personality prompt
            </label>
            <textarea
              className={styles.Textarea}
              placeholder="Enter your own prompt for AI reflections"
              value={prompt}
              onChange={handleOnChangePrompt}
            />
          </fieldset>
          <div
            style={{
              display: 'flex',
              marginTop: 25,
              justifyContent: 'flex-end',
            }}
          >
            <Dialog.Close asChild>
              <button
                type="button"
                className={styles.Button}
                onClick={handleSaveChanges}
              >
                Save changes
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Close asChild>
            <button
              type="button"
              className={styles.IconButton}
              aria-label="Close"
            >
              <CrossIcon />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
