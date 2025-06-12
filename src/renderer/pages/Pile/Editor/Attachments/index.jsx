import styles from './Attachments.module.scss';
import { useCallback, useState, useEffect } from 'react'; // Keep existing imports
import { DiscIcon, PhotoIcon, TrashIcon, TagIcon } from 'renderer/icons';
import { motion } from 'framer-motion';
import { usePilesContext } from 'renderer/context/PilesContext';
import { Capacitor } from '@capacitor/core'; // MOVED HERE

// Helper for simple path joining, ensures no double slashes
const joinCapacitorPaths = (...parts) => {
  return parts.filter(p => p && typeof p === 'string').join('/').replace(/\/\//g, '/');
};

const Attachments = ({
  post,
  onRemoveAttachment = () => {},
  editable = false,
}) => {
  const { getCurrentPilePath } = usePilesContext();

  if (!post || !post.data || !post.data.attachments) return null;

  return post.data.attachments.map((attachment) => {
    const image_exts = ['jpg', 'jpeg', 'png', 'gif', 'svg'];
    const extension = attachment.split('.').pop().toLowerCase();

    const pilePath = getCurrentPilePath();
    if (pilePath === undefined) {
        console.warn("Attachments: getCurrentPilePath() returned undefined for attachment:", attachment);
        return null;
    }
    // attachment is path relative to pile root e.g., "_attachments/image.png"
    // pilePath is relative to Directory.Data e.g., "MyPileName"
    const fullRelativePath = joinCapacitorPaths(pilePath, attachment); // e.g., "MyPileName/_attachments/image.png"

    // This path needs to be converted to a displayable URI for img src using Capacitor's APIs.
    // This will be handled in a later UI/UX adaptation phase.
    // For now, using a placeholder that indicates it's not a direct file path.
    // The actual mechanism will involve something like:
    // const [displayUri, setDisplayUri] = useState('');
    // useEffect(() => {
    //   const getUri = async () => {
    //     try {
    //       const fileUriResult = await Filesystem.getUri({ path: fullRelativePath, directory: Directory.Data });
    //       setDisplayUri(Capacitor.convertFileSrc(fileUriResult.uri));
    //     } catch (e) { console.error("Error getting file URI", e); }
    //   };
    //   getUri();
    // }, [fullRelativePath]);
    // And then <img src={displayUri} ... />
    const imgPathForDisplayPlaceholder = `capacitor-convertFileSrc(${fullRelativePath})`;


    if (image_exts.includes(extension)) {
      return (
        <motion.div
          key={attachment}
          initial={{ opacity: 0, y: -30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 0, scale: 0.9 }}
          transition={{ delay: 0.1 }}
        >
          <div className={styles.image}>
            {editable && (
              <div
                className={styles.remove}
                onClick={() => onRemoveAttachment(attachment)}
              >
                <TrashIcon className={styles.icon} />
              </div>
            )}
            <div className={styles.holder}>
              <img src={imgPathForDisplayPlaceholder} draggable="false" alt={attachment} />
            </div>
          </div>
        </motion.div>
      );
    }
    return null; // Return null for non-image attachments or if any path issue
  });
};

export default Attachments;
