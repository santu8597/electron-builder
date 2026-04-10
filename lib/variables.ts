/**
 * Application-wide configuration variables
 * Centralized configuration for backend URLs and other constants
 */

// Backend API URL
export const BACKEND_API_URL ='https://paperkraft-admin.vercel.app'

// For development/debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('Backend API URL:', BACKEND_API_URL)
}
