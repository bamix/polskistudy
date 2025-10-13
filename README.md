# Тренажёр склонений (польский) — Vue 3 + Vite

Простой тренажёр для отработки склонения **прилагательных и существительных** в польском языке.

## Данные

Все формы слов лежат в `public/data.json`. Добавляйте свои слова, следуя существующей схеме.

## Деплой на GitHub Pages (ветка `gh-pages`)

Проект уже содержит GitHub Actions workflow `.github/workflows/deploy.yml`.  
При пуше в ветку `main` автоматически выполняется сборка и публикация содержимого `dist/` в ветку `gh-pages`.

**Важно:** в `vite.config.js` установлено `base: './'`, чтобы приложение корректно работало под путём `/user/repo/`.

После первого деплоя включите Pages в настройках репозитория: **Settings → Pages → Branch: gh-pages (/root)**.

## Стек

- Vue 3
- Vite
- Vuetify 3 (компоненты UI)
- Material Design Icons (@mdi/font)

## Запуск (dev)

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
npm run preview
```

## Лицензия

MIT
