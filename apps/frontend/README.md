# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Offline AI Insights Cache

The frontend no longer performs runtime LLM calls for insights. It reads from a
static JSON file:

- `public/insights-cache.json`

Format:

```json
{
  "generatedAt": "2026-07-02T00:00:00Z",
  "entries": {
    "page=home|destination=brazil|month=february|year=2026": {
      "page": "home",
      "insights": "- Example insight line 1\n- Example insight line 2",
      "analytics": {}
    }
  }
}
```

Key format used by the app:

- `page=<page>|destination=<destination>|month=<month>|year=<year>`
- For simulation page, two extra tokens are appended:
  - `|base_tlc=<number>|simulated_tlc=<number>` (2 decimal places)

Normalization rules:

- values are lowercased
- spaces are converted to `_`
- missing values default to `all` (or `na` for numeric simulation values)

When a key is not found, the panel shows the existing empty state message.

Insights mode can be configured through `VITE_INSIGHTS_MODE`:

- `hybrid` (default): cache first, fallback to `/insights` API when key is missing
- `cache-only`: read cache only, never call API
- `api-only`: always call API, ignore cache

### Populate cache with LLM responses

Use the backend batch generator to fill `public/insights-cache.json`.

From repository root:

```bash
python apps/backend/generate_insights_cache.py --max-entries 5
```

Then run full generation:

```bash
python apps/backend/generate_insights_cache.py
```

Useful options:

- `--destinations "Brazil,Argentina,USA"`
- `--pages "home,cost_components,trends"`
- `--simulation-percents "-10,-5,0,5,10"`
- `--overwrite` to rebuild all entries from scratch
