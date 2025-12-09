# Environment Variables Setup

## Quick Setup

1. Copy the example environment file:
```bash
cp env.example .env.local
```

2. Edit `.env.local` and set your backend URL:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

3. Restart your Next.js development server:
```bash
npm run dev
```

## Environment Variables

### `NEXT_PUBLIC_BACKEND_URL`
The base URL of your Django backend server (without `/api` suffix).

**Examples:**
- Local development: `http://localhost:8000`
- Production: `https://api.yourdomain.com`
- Custom port: `http://localhost:8080`

**Note:** The `/api` suffix is automatically added by the API client.

### `NEXT_PUBLIC_API_URL` (Alternative)
If you prefer to include the `/api` suffix yourself, you can use this instead:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Common Issues

### "Failed to fetch" Error

1. **Check backend is running:**
   ```bash
   cd backend
   python manage.py runserver
   ```

2. **Verify the URL in `.env.local`:**
   - Make sure there's no trailing slash
   - Make sure the port matches your backend server
   - For production, ensure the URL is correct

3. **Check CORS settings:**
   - In development, CORS allows all origins
   - For production, update `CORS_ALLOWED_ORIGINS` in `backend/eventmanager/settings.py`

4. **Restart Next.js server:**
   - Environment variables are loaded at build time
   - You must restart the dev server after changing `.env.local`

### Testing the Connection

You can test if the backend is accessible by visiting:
- `http://localhost:8000/api/cuisines/` (should show authentication required error, not connection error)

## Production Setup

For production, make sure to:

1. Set `NEXT_PUBLIC_BACKEND_URL` to your production backend URL
2. Update CORS settings in Django to only allow your frontend domain
3. Ensure both frontend and backend are using HTTPS in production

