# Markdown Support in Chat Interface

The frontend chat interface now supports **full markdown rendering** for assistant messages with syntax highlighting for code blocks.

## Features

### ✅ Supported Markdown Features

1. **Headings** (H1-H6)
   ```markdown
   # Heading 1
   ## Heading 2
   ### Heading 3
   ```

2. **Text Formatting**
   - **Bold** - `**bold**` or `__bold__`
   - *Italic* - `*italic*` or `_italic_`
   - ~~Strikethrough~~ - `~~text~~`
   - `Inline code` - `` `code` ``

3. **Lists**
   ```markdown
   - Unordered list item 1
   - Unordered list item 2

   1. Ordered list item 1
   2. Ordered list item 2
   ```

4. **Links**
   ```markdown
   [Link text](https://example.com)
   ```

5. **Code Blocks with Syntax Highlighting**
   ````markdown
   ```javascript
   function hello() {
     console.log('Hello, world!');
   }
   ```
   ````

   Supported languages: JavaScript, Python, TypeScript, HTML, CSS, JSON, Bash, and many more via highlight.js

6. **Blockquotes**
   ```markdown
   > This is a blockquote
   > It can span multiple lines
   ```

7. **Tables**
   ```markdown
   | Header 1 | Header 2 |
   |----------|----------|
   | Cell 1   | Cell 2   |
   | Cell 3   | Cell 4   |
   ```

8. **Horizontal Rules**
   ```markdown
   ---
   ```

9. **Images**
   ```markdown
   ![Alt text](image-url.jpg)
   ```

## Technical Implementation

### Libraries Used

- **`marked`** (v17.0.0) - Fast markdown parser with GitHub Flavored Markdown support
- **`highlight.js`** (v11.11.1) - Syntax highlighting for code blocks
- **`dompurify`** (v3.3.0) - HTML sanitization to prevent XSS attacks

### Component Structure

```
MarkdownRenderer.vue
├── Parses markdown using marked
├── Highlights code using highlight.js
├── Sanitizes HTML using DOMPurify
└── Renders safe HTML
```

### Security

All rendered HTML is sanitized using DOMPurify with a strict allowlist of safe tags and attributes to prevent XSS attacks.

**Allowed tags:**
- Text: `p`, `br`, `strong`, `em`, `u`, `s`, `code`, `pre`
- Links: `a`
- Lists: `ul`, `ol`, `li`
- Quotes: `blockquote`
- Headers: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- Media: `img`
- Layout: `div`, `span`, `hr`

**Allowed attributes:**
- `href`, `target`, `rel` (for links)
- `class` (for styling)
- `src`, `alt`, `title` (for images)

### Styling

The MarkdownRenderer component includes comprehensive Tailwind CSS styles for:
- Proper spacing and typography
- Dark mode support
- Responsive design
- Code block styling with background colors
- Table borders and formatting
- Link hover effects

### Syntax Highlighting Theme

Currently using **Atom One Dark** theme for code blocks. To change the theme:

1. Open `frontend/src/main.ts`
2. Replace the import:
   ```typescript
   import 'highlight.js/styles/atom-one-dark.css';
   ```

Available themes:
- `github.css` - GitHub light theme
- `github-dark.css` - GitHub dark theme
- `monokai.css` - Monokai
- `vs.css` - Visual Studio light
- `atom-one-dark.css` - Atom One Dark (current)

See [highlight.js demo](https://highlightjs.org/static/demo/) for all available themes.

## Usage

### In Components

The MarkdownRenderer is automatically used for all **assistant messages**. User messages remain as plain text for simplicity.

```vue
<MarkdownRenderer :content="message.content" />
```

### Message Components

- **`Message.vue`** - Renders completed messages (uses MarkdownRenderer for assistant)
- **`StreamingMessage.vue`** - Renders streaming messages (uses MarkdownRenderer)

## Examples

### Example 1: Code with Explanation

**Input:**
```markdown
Here's how to implement a function in JavaScript:

```javascript
function calculateSum(a, b) {
  return a + b;
}
```

This function takes two parameters and returns their sum.
```

**Output:** Rendered with syntax highlighted code block

### Example 2: List with Code

**Input:**
```markdown
To install dependencies:

1. Install Node.js
2. Run the following command:
   ```bash
   npm install
   ```
3. Start the development server
```

**Output:** Numbered list with inline code block

### Example 3: Table

**Input:**
```markdown
| Feature | Status |
|---------|--------|
| Markdown | ✅ Done |
| Code highlighting | ✅ Done |
| Dark mode | ✅ Done |
```

**Output:** Formatted table with proper borders

## Performance Considerations

- Markdown parsing is done on-demand using Vue computed properties
- Results are cached automatically by Vue's reactivity system
- Syntax highlighting is performed only once per code block
- HTML sanitization adds minimal overhead

## Future Enhancements

Potential improvements:
- [ ] Copy button for code blocks
- [ ] Line numbers in code blocks
- [ ] Mermaid diagram support
- [ ] LaTeX/Math equation rendering
- [ ] Collapsible sections
- [ ] Custom syntax highlighting themes based on user preference
