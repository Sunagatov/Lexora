# Lexora

A personal multilingual vocabulary library for collecting words and phrases, practising them and tracking what you know.

<p>
  <a href="https://buymeacoffee.com/lucky_1uck">
    <img src="https://img.shields.io/badge/Support_the_project-FFDD00?style=for-the-badge&amp;logo=buymeacoffee&amp;logoColor=black" alt="Support the project" width="260" height="40">
  </a>
</p>

## Learn across languages

Keep separate words, topics, favourites and learning progress for **English,
Mandarin Chinese, Spanish, German, Turkish, Tatar, Arabic, French and Portuguese**.
Russian and English translation views show the translations saved in your library.

## Main features

- **Vocabulary library:** search, combine filters and sort by knowledge, CEFR and other word properties.
- **Topics and favourites:** organise words and return to useful phrases quickly.
- **Daily Word Mix:** practise a generated set with configurable study preferences.
- **Pronunciation:** audio controls, IPA and approximate reading hints where available.
- **Word management:** add and edit entries, examples and translations; preview workbook imports and export vocabulary.
- **My Lexora:** language selection, shared preferences, appearance, statistics and library tools.
- **Offline library:** save a library in a production frontend build and sync supported changes after reconnecting.

Lexora is designed around a single owner, rather than a public multi-user learning platform.
Optional AI enrichment requires separately configured provider access; ordinary
vocabulary browsing does not require an AI key.

## Stack

| Layer | Technology |
| --- | --- |
| API | Python 3.12, FastAPI, Pydantic |
| Data | SQLAlchemy 2, PostgreSQL, Alembic |
| UI | React 19, TypeScript, Vite |
| Checks | pytest, Ruff, Vitest, ESLint |

## Local development

The repository includes [local Compose configuration](docker-compose.yml) for
PostgreSQL, the backend and the frontend. Copy the root `.env.example` to `.env`
and configure local authentication/database values before starting that stack.
Its published ports are `5432` for PostgreSQL, `8000` for the API and `5173` for
the frontend. Fresh databases need the Alembic migrations in the backend setup.

For direct development, install Python 3.12+ and Node.js 20 or 22 with npm.
Follow the module instructions:

- [Backend setup and database migrations](backend/README.md).
- [Frontend setup and offline testing](frontend/README.md).

When running Vite directly, its API proxy defaults to port `8002`; set
`LOCAL_API_PORT=8000` if your local API runs on port `8000`.

## Repository map

| Directory | Contents |
| --- | --- |
| [backend](backend) | API features, migrations and tests |
| [frontend](frontend) | Browser application, styles and tests |
| [docs/ai](docs/ai) | Architecture, invariants and feature-specific development notes |
| [scripts/ai](scripts/ai) | Documentation consistency checks |

## Checks

Run the relevant module's checks from its own directory:

```bash
# backend/
python -m pytest
ruff check .

# frontend/
npm test
npm run lint
npm run build
```

## Contributing

Start with [AGENTS.md](AGENTS.md) and the [request routing guide](docs/ai/request-routing-guide.md)
when using an AI coding assistant. Source and local-development documentation
belong here; private production operations belong in Vault.

## ☕ Support the project

If this project helps you learn or build, you can support its development.

<p>
  <a href="https://buymeacoffee.com/lucky_1uck">
    <img src="https://img.shields.io/badge/Support_the_project-FFDD00?style=for-the-badge&amp;logo=buymeacoffee&amp;logoColor=black" alt="Support the project" width="260" height="40">
  </a>
</p>
