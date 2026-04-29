# chat-frontend

Frontend repo for **mychattingapp**.

## Related Repos

- Backend: https://github.com/mychattingapp/chat-backend

## Tech Stack

- **React**
- **TypeScript**
- **Vite**
- **Material UI**
- **React Router**

## Current Status

- Google OAuth login flow is wired to the backend.
- Cookie-based auth integration with the backend is in place.
- Vercel SPA rewrites are configured for client-side routes.

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- Running backend API from the companion backend repo

### 1) Install

```bash
npm install
```

### 2) Environment Variables

Create a `.env` file in this folder:

```env
VITE_BASE_SERVER_URL=http://localhost:3000
```

This should point to the backend base URL.

### 3) Run the Frontend

```bash
npm run dev
```

By default, Vite serves the app at:

```text
http://localhost:5173
```

## Build

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Notes

- This frontend is intended to work with the companion backend API.
- OAuth login redirects users to the backend first, which then redirects back to the frontend after authentication.
- Client-side routes such as `/login` are handled through the Vercel SPA rewrite configuration in `vercel.json`.
