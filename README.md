# chat-frontend

Frontend for **mychattingapp**, a real-time chat application.

## Related Repos

- Backend: https://github.com/mychattingapp/chat-backend

## Tech Stack

- **React**
- **TypeScript**
- **Vite**
- **Material UI**
- **React Router**
- **Socket.IO client**

## Features

- Google OAuth login flow is wired to the backend.
- Cookie-based auth integration with the backend is in place.
- Authenticated chat socket connection with cookie credentials.
- Friends, friend requests, and start-chat flows.
- Direct chat list with last-message previews and relative timestamps.
- Message view with grouped bubbles, timestamps, day separators, older-message pagination, and scroll-to-latest affordance.
- Sending state disables the composer until the current message send completes.
- Optional incoming-message notification sound from `public/sounds/message-notification.mp3`.
- Vercel SPA rewrites are configured for client-side routes.

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- Running backend API from the companion backend repo.

### 1) Install

```bash
npm install
```

### 2) Environment Variables

Create a `.env` file in this folder:

```env
VITE_BASE_SERVER_URL=http://localhost:3000
```

This should point to the backend base URL. It is used for both REST API requests and Socket.IO.

### 3) Run the Frontend

```bash
npm run dev
```

By default, Vite serves the app at:

```text
http://localhost:5173
```

## Scripts

```bash
npm run build
```

Runs TypeScript build checks and creates a Vite production build.

```bash
npm run lint
```

Runs ESLint.

```bash
npm run preview
```

Previews the production build locally.

## Project Structure

- `src/app` - top-level app shell and route pages
- `src/features/auth` - OAuth login, auth state, logout flow
- `src/features/chats` - chat APIs, socket hook, chat sidebar/main components, chat types
- `src/features/friends` - friend request APIs, hooks, and UI
- `src/features/home` - profile/home feature components
- `src/shared` - shared UI utilities such as snackbar and placeholder components
- `src/lib` - API client wrapper with cookie credentials and token refresh retry

## Notes

- This frontend is intended to work with the companion backend API.
- OAuth login redirects users to the backend first, which then redirects back to the frontend after authentication.
- API requests use `credentials: 'include'`, so the backend `CLIENT_URL` must match the frontend origin for CORS/cookies.
- Client-side routes such as `/login` are handled through the Vercel SPA rewrite configuration in `vercel.json`.
