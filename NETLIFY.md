# Deploying to Netlify

This project uses Nitro server functions for its routes and API. The Vite
configuration selects Nitro's Netlify preset automatically when Netlify sets
`NETLIFY`; other production builds continue to use the Vercel preset.

Connect the repository to Netlify and use the settings in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: 22

Sign-in and server-side account storage have been removed. No database or OAuth
environment variables are required. Customer, object, material, order, and
settings data are stored only in the current browser's local storage; use the
JSON backup controls in Settings regularly. Browser data is not synchronized
between devices and can be lost if the browser's site data is cleared.

## Установка как приложение (PWA)

После деплоя на Netlify (адрес `https://...netlify.app`, HTTPS обязателен) сайт можно установить:

- **Ноутбук (Chrome / Edge):** откройте сайт → значок «Установить» в адресной строке (или меню ⋮ → «Установить Okno Master Pro»).
- **Android (Chrome):** откройте сайт → меню ⋮ → «Установить приложение» / «Добавить на главный экран».

Файлы PWA: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*`. После первого открытия онлайн
приложение запускается и без интернета (данные хранятся в браузере — делайте резервные копии JSON в «Настройках»).
При изменении кэшируемых файлов увеличьте `VERSION` в `public/sw.js`.
