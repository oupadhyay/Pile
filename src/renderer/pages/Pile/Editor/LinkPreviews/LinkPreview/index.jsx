import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLinksContext } from 'renderer/context/LinksContext';
import { ChainIcon } from 'renderer/icons';
import PropTypes from 'prop-types';
import styles from './LinkPreview.module.scss';

const isUrlYouTubeVideo = (url) => {
  // Regular expression to check for various forms of YouTube URLs
  const regExp =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return regExp.test(url);
};

export default function LinkPreview({ url }) {
  const { getLink } = useLinksContext();
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState(null);

  const toggleExpand = () => setExpanded(!expanded);

  useEffect(() => {
    const getPreview = async (theUrl) => {
      const data = await getLink(theUrl);
      setPreview(data);
    };

    getPreview(url);
  }, [url, getLink]);

  if (!preview) return <div className={styles.placeholder} />;

  const createYouTubeEmbed = (videoUrl) => {
    // Extract the video ID from the YouTube URL
    const regExp = /^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#?&]*).*/;
    const match = videoUrl.match(regExp);

    if (match && match[2].length === 11) {
      return (
        <div className={styles.youtube}>
          <iframe
            width="100%"
            height="auto"
            src={`https://www.youtube.com/embed/${match[2]}?si=w-plylbVGS7t7O4b"`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture;"
            allowFullScreen
          />
        </div>
      );
    }
    return null;
  };

  const renderImage = () => {
    if (!preview?.images || preview.images.length === 0) return null;

    const image = preview.images[0];
    if (!image || image.trim() === '') return null;

    return (
      <div className={styles.image}>
        <img src={image} alt="Preview" />
      </div>
    );
  };

  if (isUrlYouTubeVideo(url)) {
    return createYouTubeEmbed(url);
  }

  const renderAICard = () => {
    // check if AI card is reliable and has enough content.
    if (!preview.aiCard) return null;

    // const highlights = null;  // Removed unused variable

    return (
      <div className={styles.aiCard}>
        <div className={styles.summary}>{preview?.aiCard?.summary}</div>

        {/* Highlights */}
        {preview?.aiCard?.highlights?.length > 0 && (
          <ul className={`${styles.highlights} ${expanded && styles.show}`}>
            {preview.aiCard.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
            <div
              key="overlay"
              className={`${styles.overlay} ${expanded && styles.hidden}`}
            />
          </ul>
        )}

        {/* Buttons */}
        {preview?.aiCard?.buttons?.length > 0 && (
          <div className={styles.buttons}>
            {preview.aiCard.buttons.map((btn) => (
              <a
                key={btn.title}
                href={btn.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ChainIcon className={styles.icon} />
                {btn.title}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div
        className={styles.card}
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            toggleExpand();
          }
        }}
      >
        {renderImage()}
        <div className={styles.content}>
          <a
            href={url}
            target="_blank"
            className={styles.title}
            rel="noopener noreferrer"
          >
            {preview.title}
          </a>
        </div>
        {renderAICard()}
        <div className={styles.footer}>
          {preview.favicon && preview.favicon.trim() !== '' && (
            <img
              className={styles.favicon}
              src={preview.favicon}
              alt="Favicon"
            />
          )}{' '}
          {preview?.aiCard?.category && (
            <span className={styles.category}>{preview?.aiCard?.category}</span>
          )}
          {preview?.host}
        </div>
      </div>
    </motion.div>
  );
}

LinkPreview.propTypes = {
  url: PropTypes.string.isRequired,
};
