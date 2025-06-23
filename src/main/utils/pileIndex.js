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
  }

  async sortMap(map) {
    const currentMap = map || this.index; // Use provided map or current index
    const sortOrder = (await settings.get('sortOrder')) || 'parentPost';
    let sortedEntries;

    if (sortOrder === 'mostRecentMessage') {
      sortedEntries = [...currentMap.entries()].sort(
        (a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0),
      );
    } else {
      // Default 'parentPost'
      sortedEntries = [...currentMap.entries()].sort(
        (a, b) =>
          (new Date(b[1].createdAt) || 0) - (new Date(a[1].createdAt) || 0),
      );
    }
    // Update the index directly if no map was passed
    if (!map) {
      this.index = new Map(sortedEntries);
      return this.index;
    }
    return new Map(sortedEntries);
  }

  resetIndex() {
    this.index.clear();
  }

  async load(pilePath) {
    if (!pilePath) return;

    // a different pile is being loaded
    if (pilePath !== this.pilePath) {
      this.resetIndex();
    }

    this.pilePath = pilePath;
    const indexFilePath = path.join(this.pilePath, this.fileName);

    if (fs.existsSync(indexFilePath)) {
      const data = fs.readFileSync(indexFilePath);
      const loadedIndex = new Map(JSON.parse(data));
      const sortedIndex = await this.sortMap(loadedIndex);
      this.index = sortedIndex;
    } else {
      // init empty index
      await this.save();
      // try to recreate index by walking the folder system
      const index = await this.walkAndGenerateIndex(pilePath);
      this.index = index;
      await this.save();
    }

    pileSearchIndex.initialize(this.pilePath, this.index);
    console.log('📍 SEARCH INDEX LOADED');
    await pileEmbeddings.initialize(this.pilePath, this.index);
    console.log('📍 VECTOR INDEX LOADED');

    return this.index;
  }

  walkAndGenerateIndex = async (pilePath) => {
    const files = await walk(pilePath);
    files.forEach((filePath) => {
      const relativeFilePath = path.relative(pilePath, filePath);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);
      this.index.set(relativeFilePath, data);
    });

    this.index = await this.sortMap(this.index);
    return this.index;
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
    const result = Array.from(this.index.entries());
    console.log(
      'get() method called, returning array with length:',
      result.length,
    );
    console.log('First entry:', result[0]);
    return result;
  }

  async add(relativeFilePath) {
    const filePath = path.join(this.pilePath, relativeFilePath);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContent);
    this.index.set(relativeFilePath, data);
    // add to search and vector index
    pileSearchIndex.initialize(this.pilePath, this.index);
    pileEmbeddings.addDocument(relativeFilePath, data);
    await this.save();
    return this.index;
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
    pileEmbeddings.regenerateEmbeddings(this.index);
    await this.save();
    return;
  }

  async update(relativeFilePath, data) {
    this.index.set(relativeFilePath, data);
    pileSearchIndex.initialize(this.pilePath, this.index);
    pileEmbeddings.addDocument(relativeFilePath, data);
    await this.save();
    return this.index;
  }

  async remove(relativeFilePath) {
    this.index.delete(relativeFilePath);
    await this.save();

    return this.index;
  }

  async save() {
    if (!this.pilePath) return;
    if (!fs.existsSync(this.pilePath)) {
      fs.mkdirSync(this.pilePath, { recursive: true });
    }

    const sortedIndex = await this.sortMap(this.index);
    this.index = sortedIndex;
    const filePath = path.join(this.pilePath, this.fileName);
    const entries = this.index.entries();

    if (!entries) return;

    const strMap = JSON.stringify(Array.from(entries));
    fs.writeFileSync(filePath, strMap);
  }

  async refreshSort() {
    console.log(
      'refreshSort called - before save, index size:',
      this.index.size,
    );
    await this.save();
    console.log(
      'refreshSort called - after save, index size:',
      this.index.size,
    );

    // Log first few entries to see the order
    const entries = Array.from(this.index.entries()).slice(0, 3);
    console.log(
      'First 3 entries after refreshSort:',
      entries.map(([key, meta]) => ({
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
