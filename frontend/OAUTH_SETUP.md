# Google OAuth Setup Instructions

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Identity Services API
4. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client IDs"
5. Configure OAuth consent screen first:
   - Choose "External" user type for testing
   - Fill in required app information
   - Add your email as a test user
6. For application type, choose "Web application"
7. Add authorized JavaScript origins:
   - `http://localhost:5173` (for development)
   - `https://yourdomain.com` (for production)
8. Add authorized redirect URIs (optional for this implementation):
   - `http://localhost:5173` (for development)
   - `https://yourdomain.com` (for production)
9. Copy the Client ID and add it to `.env` file as `VITE_GOOGLE_CLIENT_ID`

## Backend Configuration

Make sure your backend server.js has the correct Google Client ID configured:

```javascript
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
```

Add this to your backend `.env` file:

```
GOOGLE_CLIENT_ID=your_google_client_id_here
```

## Frontend Configuration

Update your frontend `.env` file:

```
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

## Testing

1. Update both frontend and backend `.env` files with your actual Google Client ID
2. Restart both development servers
3. Try logging in with the Google button
4. Check browser console for any error messages

## Troubleshooting

### Google Button Not Appearing

- Check browser console for errors
- Verify VITE_GOOGLE_CLIENT_ID is set correctly
- Ensure internet connection is working
- Try refreshing the page

### Google Login Not Working

- Verify the Client ID matches between frontend and backend
- Check that the domain is authorized in Google Cloud Console
- Ensure the OAuth consent screen is properly configured
- Check browser console and network tab for errors

### Common Issues

- **Invalid Client ID**: Double-check the Client ID in both .env files
- **Origin Not Allowed**: Add your domain to authorized JavaScript origins
- **Consent Screen Issues**: Make sure to publish your OAuth consent screen or add test users

## Important Notes

- The Google Client ID in the frontend (VITE_GOOGLE_CLIENT_ID) must be the same as the one in the backend (GOOGLE_CLIENT_ID)
- For production, make sure to publish your OAuth consent screen
- Test thoroughly in both development and production environments
- Facebook login has been removed from this implementation
- Test thoroughly in both development and production environments
