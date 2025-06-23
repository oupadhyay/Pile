const fs = require('fs');
const path = require('path');
const glob = require('glob');
const settings = require('electron-settings');
const matter = require('gray-matter');
const { sendIndexUpdatedEventToRenderer } = require('../main'); // Adjusted path
const pileSearchIndex = require('./pileSearchIndex');
const pileEmbeddings = require('./pileEmbeddings');
const { walk } = require('../util');
const { convertHTMLToPlainText } = require('../util');

class PileIndex {
  constructor() {
    this.fileName = 'index.json';
    this.pilePath = null;
    this.index = new Map();
    this.sortedIndexKeys = []; // Stores sorted keys
  }

  async sortMap() {
    const sortOrder = (await settings.get('sortOrder')) || 'parentPost';
    let parentPostEntries = [];

    // First, gather all actual parent post entries
    for (const [key, meta] of this.index) {
      if (!meta.isReply) {
        parentPostEntries.push([key, meta]);
      }
    }

    let sortedParentKeys;

    if (sortOrder === 'mostRecentMessage') {
      // Calculate effective updatedAt for each thread (parent + its replies)
      const threadsWithEffectiveUpdate = parentPostEntries.map(([key, parentMeta]) => {
        let effectiveUpdatedAt = parentMeta.updatedAt ? new Date(parentMeta.updatedAt).getTime() : 0;

        if (parentMeta.replies && parentMeta.replies.length > 0) {
          for (const replyPath of parentMeta.replies) {
            const replyMeta = this.index.get(replyPath);
            if (replyMeta && replyMeta.updatedAt) {
              const replyUpdatedAt = new Date(replyMeta.updatedAt).getTime();
              if (replyUpdatedAt > effectiveUpdatedAt) {
                effectiveUpdatedAt = replyUpdatedAt;
              }
            }
          }
        }
        return { key, effectiveUpdatedAt };
      });

      // Sort threads by their effective updatedAt
      threadsWithEffectiveUpdate.sort((a, b) => b.effectiveUpdatedAt - a.effectiveUpdatedAt);
      sortedParentKeys = threadsWithEffectiveUpdate.map(thread => thread.key);

    } else {
      // Default 'parentPost' sort by createdAt
      parentPostEntries.sort(
        (a, b) =>
          (new Date(b[1].createdAt).getTime() || 0) - (new Date(a[1].createdAt).getTime() || 0)
      );
      sortedParentKeys = parentPostEntries.map(([key]) => key);
    }
    this.sortedIndexKeys = sortedParentKeys;
  }

  resetIndex() {
    this.index.clear();
    this.sortedIndexKeys = [];
  }

  async load(pilePath) {
    if (!pilePath) return;

    if (pilePath !== this.pilePath) {
      this.resetIndex();
    }

    this.pilePath = pilePath;
    const indexFilePath = path.join(this.pilePath, this.fileName);

    if (fs.existsSync(indexFilePath)) {
      const data = fs.readFileSync(indexFilePath);
      this.index = new Map(JSON.parse(data));
      // index.json is pre-sorted, but sortedIndexKeys needs to be built based on current app settings.
      await this.sortMap();
    } else {
      // No index.json, so walk dirs, build index, sort keys, and save the new index.json.
      await this.walkAndGenerateIndex(pilePath); // Populates this.index
      await this.sortMap();                     // Populates this.sortedIndexKeys
      await this.save();                         // Saves this.index (sorted) to index.json
    }

    // Initialize search and embeddings with the final state of this.index
    pileSearchIndex.initialize(this.pilePath, this.index);
    console.log('📍 SEARCH INDEX LOADED');
    await pileEmbeddings.initialize(this.pilePath, this.index);
    console.log('📍 VECTOR INDEX LOADED');

    return this.get(); // Return the sorted view
  }

  walkAndGenerateIndex = async (pilePath) => {
    const files = await walk(pilePath);
    this.index.clear(); // Ensure index is empty before populating
    files.forEach((filePath) => {
      const relativeFilePath = path.relative(pilePath, filePath);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);
      this.index.set(relativeFilePath, data);
    });
    // this.index is now populated. sortMap and save will be called by the 'load' method.
  };

  search(query) {
    let results = [];
    try {
      console.time('search-time');
      const entries = pileSearchIndex.search(query);
      results = entries.map((entry) => {
        const res = { ref: entry.ref, ...this.index.get(entry.ref) };
        return res;
      });
      console.timeEnd('search-time');
    } catch (error) {
      console.log('failed to search', error);
    }

    return results;
  }

  async vectorSearch(query, topN = 50) {
    let results = [];
    try {
      console.time('vector-search-time');
      const entries = await pileEmbeddings.search(query, topN);
      results = entries.map((entry) => {
        const res = { ref: entry, ...this.index.get(entry) };
        return res;
      });
      console.timeEnd('vector-search-time');
    } catch (error) {
      console.log('failed to vector search', error);
    }
    return results;
  }

  get() {
    // Return entries in the order of sortedIndexKeys
    const result = this.sortedIndexKeys.map((key) => [
      key,
      this.index.get(key),
    ]);
    console.log(
      'get() method called, returning sorted array with length:',
      result.length,
    );
    // console.log('First entry in sorted get():', result[0]); // Be careful if result can be empty
    return result;
  }

  async add(relativeFilePath) {
    const filePath = path.join(this.pilePath, relativeFilePath);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContent);
    this.index.set(relativeFilePath, data);
    // add to search and vector index
    pileSearchIndex.initialize(this.pilePath, this.index); // Reinitialize search index
    pileEmbeddings.addDocument(relativeFilePath, data);
    await this.sortMap(); // Update sortedIndexKeys
    await this.save();
    return this.get(); // Return sorted view
  }

  getThreadAsText(filePath) {
    try {
      const fullPath = path.join(this.pilePath, filePath);
      const fileContent = fs.readFileSync(fullPath, 'utf8');
      let { content, data: metedata } = matter(fileContent);

      content = `First entry at ${new Date(metedata.createdAt).toString()}:\n ${convertHTMLToPlainText(
        content,
      )}`;

      // concat the contents of replies
      // eslint-disable-next-line no-restricted-syntax
      for (const replyPath of metedata.replies) {
        try {
          const replyFullPath = path.join(this.pilePath, replyPath);
          const replyFileContent = fs.readFileSync(replyFullPath, 'utf8');
          const { content: replyContent, data: replyMetadata } =
            matter(replyFileContent);
          content += `\n\n Reply at ${new Date(
            replyMetadata.createdAt,
          ).toString()}:\n  ${convertHTMLToPlainText(replyContent)}`;
        } catch (error) {
          continue;
        }
      }
      return content;
    } catch (error) {
      console.log('Failed to get thread as text');
    }
  }

  // reply's parent needs to be found by checking every non isReply entry and
  // see if it's included in the replies array of the parent
  async updateParentOfReply(replyPath) {
    const reply = this.index.get(replyPath);
    if (reply.isReply) {
      for (let [filePath, metadata] of this.index) {
        if (!metadata.isReply) {
          if (metadata.replies.includes(replyPath)) {
            // this is the parent
            metadata.replies = metadata.replies.filter((p) => {
              return p !== replyPath;
            });
            metadata.replies.push(filePath);
            this.index.set(filePath, metadata);
            await this.save();
          }
        }
      }
    }
  }

  async regenerateEmbeddings() {
    // This operation might affect embeddings but not sorting order directly.
    // If it modifies metadata used for sorting (e.g. updatedAt), then sortMap and save should be called.
    // For now, assuming it doesn't change sortable metadata.
    pileEmbeddings.regenerateEmbeddings(this.index); // Operates on the raw index
    // No need to re-sort or save unless metadata used for sorting changes.
    return;
  }

  async update(relativeFilePath, data) {
    this.index.set(relativeFilePath, data);
    pileSearchIndex.initialize(this.pilePath, this.index); // Rebuilds search index
    pileEmbeddings.addDocument(relativeFilePath, data); // Updates vector index
    await this.sortMap(); // Update sortedIndexKeys
    await this.save();
    return this.get(); // Return sorted view
  }

  async remove(relativeFilePath) {
    this.index.delete(relativeFilePath);
    pileSearchIndex.initialize(this.pilePath, this.index); // Rebuilds search index
    // TODO: pileEmbeddings.removeDocument(relativeFilePath); // Assuming a method to remove from vector index
    await this.sortMap(); // Update sortedIndexKeys
    await this.save();
    return this.get(); // Return sorted view
  }

  async save() {
    if (!this.pilePath) return;
    if (!fs.existsSync(this.pilePath)) {
      fs.mkdirSync(this.pilePath, { recursive: true });
    }

    // Sort all entries in this.index by their 'createdAt' timestamp for consistent saving.
    // This ensures index.json has a predictable order and contains all data (parents and replies).
    // The dynamic thread-based sorting for display is handled by sortedIndexKeys.
    const allEntries = Array.from(this.index.entries());
    allEntries.sort(
      (a, b) =>
        (new Date(b[1].createdAt).getTime() || 0) - (new Date(a[1].createdAt).getTime() || 0)
    );

    const indexToSave = new Map(allEntries);
    const filePath = path.join(this.pilePath, this.fileName);
    const strMap = JSON.stringify(Array.from(indexToSave.entries()));
    fs.writeFileSync(filePath, strMap);
  }

  async refreshSort() {
    console.log(
      'refreshSort called - index size before sortMap:',
      this.index.size,
    );
    await this.sortMap(); // Update sortedIndexKeys
    await this.save(); // Save the potentially re-sorted main index to disk
    console.log(
      'refreshSort called - index size after save:',
      this.index.size,
    );

    // Log first few entries from the sorted view to see the order
    const sortedView = this.get().slice(0, 3);
    console.log(
      'First 3 entries after refreshSort (from get()):',
      sortedView.map(([key, meta]) => ({
        key,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
      })),
    );

    // Actual IPC call
    if (typeof sendIndexUpdatedEventToRenderer === 'function') {
      sendIndexUpdatedEventToRenderer();
    } else {
      console.error(
        'sendIndexUpdatedEventToRenderer function is not available. Check import in pileIndex.js.',
      );
    }
  }
}

module.exports = new PileIndex();
