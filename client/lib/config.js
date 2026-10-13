// Server ka origin (path ke bina). Production mein Render ka URL.
export const SERVER_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export const API_BASE = `${SERVER_URL}/api`;

// WS URL alag se na diya ho to SERVER_URL se bana lo (http -> ws, https -> wss)
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || `${SERVER_URL.replace(/^http/, 'ws')}/ws`;
