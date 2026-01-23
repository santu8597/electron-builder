/**
 * This file is only used during Electron development mode.
 * In production builds, API routes are replaced by Electron IPC handlers.
 * 
 * These routes are kept for backward compatibility when running the web version.
 */

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET() {
  return new Response(JSON.stringify({ 
    error: 'This API is only available in Electron desktop app' 
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST() {
  return new Response(JSON.stringify({ 
    error: 'This API is only available in Electron desktop app' 
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}
