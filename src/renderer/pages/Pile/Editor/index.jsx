/* eslint-disable no-use-before-define */
import { Extension } from '@tiptap/core';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useAIContext } from 'renderer/context/AIContext';
import { useToastsContext } from 'renderer/context/ToastsContext';
import usePost from 'renderer/hooks/usePost';
import useThread from 'renderer/hooks/useThread';
import { PhotoIcon } from 'renderer/icons';
import PropTypes from 'prop-types';
import Attachments from './Attachments';
import styles from './Editor.module.scss';
import LinkPreviews from './LinkPreviews';
import './ProseMirror.scss';

// Escape special characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const highlightTerms = (text, term) => {
  if (!term.trim()) return text;
  const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
  return text.replace(regex, `<span class="${styles.highlight}">$1</span>`);
};

const Editor = memo(
  ({
    postPath = null,
    editable = false,
    parentPostPath = null,
    isAI = false,
    isReply = false,
    closeReply = () => {},
    setEditable = () => {},
    reloadParentPost,
    searchTerm = null,
  }) => {
    const {
      post,
      savePost,
      attachToPost,
      detachFromPost,
      setContent,
      resetPost,
      deletePost,
    } = usePost(postPath, { isReply, parentPostPath, reloadParentPost, isAI });
    const { getThread } = useThread();
    const { generateCompletion, prepareCompletionContext } = useAIContext();
    const { addNotification, removeNotification } = useToastsContext();

    const isNew = !postPath;

    const EnterSubmitExtension = Extension.create({
      name: 'EnterSubmitExtension',
      addCommands() {
        return {
          triggerSubmit: () => () => {
            const event = new CustomEvent('submit');
            document.dispatchEvent(event);
            return true;
          },
        };
      },

      addKeyboardShortcuts() {
        return {
          Enter: ({ editor }) => {
            editor.commands.triggerSubmit();
            return true;
          },
        };
      },
    });

    const handleFile = (file) => {
      if (file && file.type.indexOf('image') === 0) {
        const fileName = file.name; // Retrieve the filename
        const fileExtension = fileName.split('.').pop(); // Extract the file extension
        // Handle the image file here (e.g., upload, display, etc.)
        const reader = new FileReader();
        reader.onload = () => {
          const imageData = reader.result;
          attachToPost(imageData, fileExtension);
        };
        reader.readAsDataURL(file);
      }
    };

    const handleDataTransferItem = (item) => {
      const file = item.getAsFile();
      if (file) {
        handleFile(file);
      }
    };

    const editor = useEditor({
      extensions: [
        StarterKit,
        Typography,
        Link,
        Placeholder.configure({
          placeholder: isAI ? 'AI is thinking...' : 'What are you thinking?',
        }),
        CharacterCount.configure({
          limit: 10000,
        }),
        EnterSubmitExtension,
      ],
      editorProps: {
        handlePaste(event) {
          const items = Array.from(event.clipboardData?.items || []);
          let imageHandled = false; // flag to track if an image was handled

          if (items) {
            items.forEach((item) => {
              // Check if the item type is an image
              if (item.type && item.type.indexOf('image') === 0) {
                handleDataTransferItem(item);
                imageHandled = true;
              }
            });
          }
          return imageHandled;
        },
        handleDrop(event, moved) {
          const imageHandled = false; // flag to track if an image was handled
          if (
            !moved &&
            event.dataTransfer &&
            event.dataTransfer.files &&
            event.dataTransfer.files[0]
          ) {
            // if dropping external files
            const files = Array.from(event.dataTransfer.files);
            files.forEach(handleFile);
            return imageHandled; // handled
          }
          return imageHandled; // not handled use default behaviour
        },
      },
      autofocus: true,
      editable,
      content: post?.content || '',
      onUpdate: ({ editor: tipTapEditor }) => {
        setContent(tipTapEditor.getHTML());
      },
    });

    const elRef = useRef();
    const [deleteStep, setDeleteStep] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isAIResponding, setIsAiResponding] = useState(false);
    const [prevDragPos, setPrevDragPos] = useState(0);

    const handleMouseDown = (e) => {
      setIsDragging(true);
      setPrevDragPos(e.clientX);
    };

    const handleMouseMove = (e) => {
      if (isDragging && elRef.current) {
        const delta = e.clientX - prevDragPos;
        elRef.current.scrollLeft -= delta;
        setPrevDragPos(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    useEffect(() => {
      if (!editor) return;
      generateAiResponse();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, isAI]);

    const handleSubmit = useCallback(async () => {
      await savePost();
      if (isNew) {
        resetPost();
        closeReply();
        return;
      }

      closeReply();
      setEditable(false);
    }, [isNew, resetPost, closeReply, setEditable, savePost]);

    // Listen for the 'submit' event and call handleSubmit when it's triggered
    useEffect(() => {
      const handleEvent = () => {
        if (editor?.isFocused) {
          handleSubmit();
        }
      };

      document.addEventListener('submit', handleEvent);

      return () => {
        document.removeEventListener('submit', handleEvent);
      };
    }, [handleSubmit, editor]);

    // This has to ensure that it only calls the AI generate function
    // on entries added for the AI that are empty.
    const generateAiResponse = useCallback(async () => {
      if (
        !editor ||
        isAIResponding ||
        !isAI ||
        editor.state.doc.textContent.length > 0
      )
        return;

      addNotification({
        id: 'reflecting',
        type: 'thinking',
        message: 'talking to AI',
        dismissTime: 10000,
      });
      setEditable(false);
      setIsAiResponding(true);

      try {
        const thread = await getThread(parentPostPath);
        const context = prepareCompletionContext(thread);

        if (context.length === 0) return;

        await generateCompletion(context, (token) => {
          if (token) {
            editor.commands.insertContent(token);
          }
        });
      } catch (error) {
        addNotification({
          id: 'reflecting',
          type: 'failed',
          message: 'AI request failed',
          dismissTime: 12000,
          onEnter: closeReply,
        });
      } finally {
        removeNotification('reflecting');
        setIsAiResponding(false);
      }
    }, [
      editor,
      isAI,
      generateCompletion,
      prepareCompletionContext,
      getThread,
      parentPostPath,
      addNotification,
      closeReply,
      isAIResponding,
      removeNotification,
      setEditable,
    ]);

    useEffect(() => {
      if (editor) {
        if (!post) return;
        if (post?.content !== editor.getHTML()) {
          editor.commands.setContent(post.content);
        }
      }
    }, [post, editor]);

    const triggerAttachment = () => attachToPost();

    useEffect(() => {
      if (editor) {
        editor.setEditable(editable);
      }
      setDeleteStep(0);
    }, [editable, editor]);

    const handleOnDelete = useCallback(async () => {
      if (deleteStep === 0) {
        setDeleteStep(1);
        return;
      }

      await deletePost();
    }, [deleteStep, setDeleteStep, deletePost]);

    const isBig = useCallback(() => {
      return editor?.storage.characterCount.characters() < 280;
    }, [editor]);

    const renderPostButton = () => {
      if (isAI) return 'Save AI response';
      if (isReply) return 'Reply';
      if (isNew) return 'Post';

      return 'Update';
    };

    if (!post) return null;

    let previewContent = post.content;
    if (searchTerm && !editable) {
      previewContent = highlightTerms(post.content, searchTerm);
    }

    return (
      <div className={`${styles.frame} ${isNew && styles.isNew}`}>
        {editable ? (
          <EditorContent
            key="new"
            className={`${styles.editor} ${isBig() && styles.editorBig} ${
              isAIResponding && styles.responding
            }`}
            editor={editor}
          />
        ) : (
          <div className={styles.uneditable}>
            <div
              key="uneditable"
              className={`${styles.editor} ${isBig() && styles.editorBig}`}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          </div>
        )}

        <LinkPreviews post={post} />

        <div
          className={`${styles.media} ${
            post?.data?.attachments.length > 0 ? styles.open : ''
          }`}
        >
          <div
            className={`${styles.scroll} ${isNew && styles.new}`}
            ref={elRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            role="presentation"
          >
            <div className={styles.container}>
              <Attachments
                post={post}
                editable={editable}
                onRemoveAttachment={detachFromPost}
              />
            </div>
          </div>
        </div>

        {editable && (
          <div className={styles.footer}>
            <div className={styles.left}>
              <button
                type="button"
                className={styles.button}
                onClick={triggerAttachment}
              >
                <PhotoIcon className={styles.icon} />
              </button>
            </div>
            <div className={styles.right}>
              {isReply && (
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={closeReply}
                >
                  Close
                </button>
              )}

              {!isNew && (
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={handleOnDelete}
                >
                  {deleteStep === 0 ? 'Delete' : 'Click again to confirm'}
                </button>
              )}
              <button
                type="button"
                tabIndex="0"
                className={styles.button}
                onClick={handleSubmit}
              >
                {renderPostButton()}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

Editor.propTypes = {
  postPath: PropTypes.string.isRequired,
  editable: PropTypes.bool.isRequired,
  parentPostPath: PropTypes.string.isRequired,
  isAI: PropTypes.bool.isRequired,
  isReply: PropTypes.bool.isRequired,
  closeReply: PropTypes.func.isRequired,
  setEditable: PropTypes.func.isRequired,
  reloadParentPost: PropTypes.func.isRequired,
  searchTerm: PropTypes.string.isRequired,
};

export default Editor;
