# Klantroef Media Analytics API

## Overview
A Node.js/Express backend for media asset management and analytics, featuring JWT authentication, Redis caching, rate limiting, and Docker support.


## Features
- JWT-protected routes
- Log media views (IP + timestamp)
- Analytics: total views, unique IPs, views per day (calculated directly from MongoDB)
- Rate limiting for view logging
- Security headers via helmet
- Dockerized for deployment
- Configurable via `.env`

## Setup Steps
1. **Clone the repo:**
   ```sh
   git clone https://github.com/Amritansu-Adi/klantroef.git
   cd klantroef
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Copy and edit environment config:**
   ```sh
   cp .env.example .env
   # Edit .env with your values
   ```
4. **Start MongoDB and Redis:**
   - MongoDB: `mongod`
   - Redis: `redis-server`
5. **Run the app:**
   ```sh
   npm start
   ```

6. **Run with Docker Compose (recommended for full stack):**
   ```sh
   docker-compose up --build
   ```
   This will start your app, MongoDB, and Redis together. Your app will be available at `http://localhost:3000`.

7. **Run in Docker (standalone app):**
   ```sh
   docker build -t klantroef .
   docker run -p 3000:3000 --env-file .env klantroef
   ```
   Make sure MongoDB and Redis are running and accessible from your container.


## API Endpoints
- `POST /auth/signup` — Register admin user
- `POST /auth/login` — Login, get JWT
- `POST /media` — Add media (JWT required)
- `GET /media/:id/stream-url` — Get secure stream link
- `POST /media/:id/view` — Log a view (JWT required, rate limited)
- `GET /media/:id/analytics` — Get analytics (JWT required, calculated from MongoDB)

## Testing
- Use Postman or curl for manual testing


## Automated Testing

This project uses Jest and Supertest for comprehensive backend testing, including:
- Authentication and JWT protection
- Media creation, streaming, view logging, analytics
- Rate limiting
- Edge cases: invalid input, missing fields, invalid JWT, analytics with zero views

If you see a warning about open handles after running tests, it is likely due to lingering MongoDB or Redis connections. This does not affect correctness. You can run:

```
npm test -- --detectOpenHandles
```

to help diagnose any remaining open handles.

### Run tests

```sh
npm test