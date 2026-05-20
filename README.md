# Nimbus Nook

Nimbus Nook is a whimsical anxiety calming web app by Quantum Cupcake. It includes:

- Local user login with Web Crypto password hashing.
- IndexedDB persistence for check-ins, journal pages, stickers, quizzes, and toolkit data.
- A cloud-shaped breathing control with generated lofi-style Web Audio.
- An animated sticker journal with 60 anxiety-focused templates.
- Interactive quizzes, grounding tools, a panic pocket plan, brave ladder, and private insights.

## Run locally

```bash
node dev-server.js
```

Then open `http://localhost:4173`.

## Privacy model

Nimbus Nook is designed for GitHub Pages hosting, so account records and app data are stored locally in the visitor's browser through IndexedDB. This avoids needing hosted database credentials while still giving each browser a persistent private database.

## GitHub Pages

The app is static and can be served directly from the `main` branch root.

## Care note

This app is for self-help reflection and regulation support. It is not a diagnosis, therapy, medical advice, or emergency service.
