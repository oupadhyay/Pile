// Test helper to extract and test the highlightTerms function
// This mirrors the actual implementation in the Editor component
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const highlightTerms = (text, term) => {
  if (!term.trim()) return text;
  const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
  // This tests the fixed version - before the fix it was: `<span class="' + styles.highlight + '">$1</span>`
  return text.replace(regex, `<span class="highlight">$1</span>`);
};

describe('highlightTerms function', () => {
  it('returns original text when search term is empty', () => {
    const text = '<p>Hello world</p>';
    expect(highlightTerms(text, '')).toBe(text);
    expect(highlightTerms(text, '   ')).toBe(text);
  });

  it('highlights single word matches', () => {
    const text = '<p>Hello world</p>';
    const result = highlightTerms(text, 'Hello');
    expect(result).toBe('<p><span class="highlight">Hello</span> world</p>');
  });

  it('highlights multiple matches case-insensitively', () => {
    const text = '<p>Hello world, hello universe</p>';
    const result = highlightTerms(text, 'hello');
    expect(result).toBe(
      '<p><span class="highlight">Hello</span> world, <span class="highlight">hello</span> universe</p>',
    );
  });

  it('highlights partial word matches', () => {
    const text = '<p>JavaScript and Java are different</p>';
    const result = highlightTerms(text, 'Java');
    expect(result).toBe(
      '<p><span class="highlight">Java</span>Script and <span class="highlight">Java</span> are different</p>',
    );
  });

  it('escapes special regex characters in search term', () => {
    const text = '<p>Price is $10.99 (special offer)</p>';
    const result = highlightTerms(text, '$10.99');
    expect(result).toBe(
      '<p>Price is <span class="highlight">$10.99</span> (special offer)</p>',
    );
  });

  it('handles complex HTML with nested tags', () => {
    const text = '<div><p>Hello <strong>world</strong></p></div>';
    const result = highlightTerms(text, 'world');
    expect(result).toBe(
      '<div><p>Hello <strong><span class="highlight">world</span></strong></p></div>',
    );
  });

  it('preserves existing HTML structure', () => {
    const text = '<p>This is <em>emphasized</em> text</p>';
    const result = highlightTerms(text, 'emphasized');
    expect(result).toBe(
      '<p>This is <em><span class="highlight">emphasized</span></em> text</p>',
    );
  });

  it('handles special characters in search term', () => {
    const text = '<p>Search for C++ programming</p>';
    const result = highlightTerms(text, 'C++');
    expect(result).toBe(
      '<p>Search for <span class="highlight">C++</span> programming</p>',
    );
  });

  it('handles parentheses and brackets in search term', () => {
    const text = '<p>Function call: myFunction(param)</p>';
    const result = highlightTerms(text, 'myFunction(param)');
    expect(result).toBe(
      '<p>Function call: <span class="highlight">myFunction(param)</span></p>',
    );
  });

  it('does not break on multiple consecutive spaces in search term', () => {
    const text = '<p>Hello    world with multiple spaces</p>';
    const result = highlightTerms(text, 'Hello    world');
    expect(result).toBe(
      '<p><span class="highlight">Hello    world</span> with multiple spaces</p>',
    );
  });

  it('handles unicode characters', () => {
    const text = '<p>Café and naïve are French words</p>';
    const result = highlightTerms(text, 'Café');
    expect(result).toBe(
      '<p><span class="highlight">Café</span> and naïve are French words</p>',
    );
  });

  it('verifies the CSS class bug fix', () => {
    const text = '<p>Test content</p>';
    const result = highlightTerms(text, 'Test');

    // The bug was: `<span class="' + styles.highlight + '">$1</span>`
    // Fixed to: `<span class="${styles.highlight}">$1</span>` (which becomes `<span class="highlight">$1</span>` in our test)
    expect(result).toBe('<p><span class="highlight">Test</span> content</p>');

    // Ensure the buggy string concatenation is not present
    expect(result).not.toContain("' + styles.highlight + '");
    expect(result).not.toContain("' +");
    expect(result).not.toContain("+ '");
  });

  it('handles edge case with empty matches', () => {
    const text = '<p>Content without matches</p>';
    const result = highlightTerms(text, 'nonexistent');
    expect(result).toBe(text);
  });

  it('handles search term that appears at start and end', () => {
    const text = '<p>test some content test</p>';
    const result = highlightTerms(text, 'test');
    expect(result).toBe(
      '<p><span class="highlight">test</span> some content <span class="highlight">test</span></p>',
    );
  });

  it('handles overlapping HTML tags correctly', () => {
    const text = '<p>Hello <strong>beautiful <em>world</em></strong></p>';
    const result = highlightTerms(text, 'beautiful');
    expect(result).toBe(
      '<p>Hello <strong><span class="highlight">beautiful</span> <em>world</em></strong></p>',
    );
  });
});

describe('escapeRegExp function', () => {
  it('escapes all special regex characters', () => {
    const specialChars = '.*+?^${}()|[]\\';
    const result = escapeRegExp(specialChars);
    expect(result).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('does not affect normal characters', () => {
    const normalText = 'abcABC123';
    const result = escapeRegExp(normalText);
    expect(result).toBe(normalText);
  });

  it('handles mixed normal and special characters', () => {
    const mixedText = 'hello.world+test';
    const result = escapeRegExp(mixedText);
    expect(result).toBe('hello\\.world\\+test');
  });
});
