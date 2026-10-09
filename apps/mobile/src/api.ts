import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const TOKEN_KEY = 'thekabook_session';

export function getApiBaseUrl(): string {
  // 1. Web browser: Always use window.location.hostname for seamless dev & prod
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || 'localhost';
    const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (envUrl && !envUrl.includes('localhost') && !/^https?:\/\/(192\.168\.|10\.|172\.)/.test(envUrl)) {
      return envUrl.replace(/\/$/, '');
    }
    return `http://${hostname}:4000`;
  }

  // 2. Explicit env URL
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/$/, '');
  }

  // 3. Expo Constants extra.apiUrl (embedded into standalone APK binary)
  const configApiUrl = (Constants.expoConfig?.extra as any)?.apiUrl;
  if (configApiUrl) {
    return configApiUrl.replace(/\/$/, '');
  }

  // 4. Mobile (Expo Go & dev client): Auto-detect Metro bundler IP
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost || (Constants as any)?.manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:4000`;
    }
  }

  // 5. React Native SourceCode scriptURL
  const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
  if (scriptURL) {
    try {
      const match = scriptURL.match(/https?:\/\/([^/:]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:4000`;
      }
    } catch { }
  }

  // 6. Default LAN IP fallback
  return 'http://192.168.1.9:4000';
}

export function getPublicReportBaseUrl(): string {
  // 1. Prefer public tunnel / cloud URL if present in expo config
  const configApiUrl = (Constants.expoConfig?.extra as any)?.apiUrl;
  if (configApiUrl && !configApiUrl.includes('localhost') && !/^https?:\/\/(192\.168\.|10\.|172\.)/.test(configApiUrl)) {
    return configApiUrl.replace(/\/$/, '');
  }
  // 2. Explicit public env variable
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl && !envUrl.includes('localhost') && !/^https?:\/\/(192\.168\.|10\.|172\.)/.test(envUrl)) {
    return envUrl.replace(/\/$/, '');
  }
  // 3. Fallback to standard base URL
  return getApiBaseUrl();
}

export const getToken = async () => Platform.OS === 'web' ? sessionStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);

export async function saveToken(token: string | null) {
  if (Platform.OS === 'web') { token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY); return; }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token); else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

const REMEMBERED_EMAIL_KEY = 'thekabook_remembered_email';

export async function getRememberedEmail(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(REMEMBERED_EMAIL_KEY) : null;
    }
    return await SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function saveRememberedEmail(email: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      return;
    }
    if (email) await SecureStore.setItemAsync(REMEMBERED_EMAIL_KEY, email);
    else await SecureStore.deleteItemAsync(REMEMBERED_EMAIL_KEY);
  } catch { }
}

export async function request(path: string, token: string | null, body?: unknown) {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  };

  const urlsToTry = [
    baseUrl + path,
    ...(baseUrl.includes('loca.lt') ? [`http://192.168.1.9:4000${path}`] : []),
  ];

  let lastError: any = null;

  // Auto-retry up to 3 times to handle tunnel warm-up seamlessly
  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const url of urlsToTry) {
      try {
        const res = await fetch(url, {
          method: body === undefined ? 'GET' : 'POST',
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });

        const rawText = await res.text();
        let json: any = null;
        if (rawText && rawText.trim().length > 0) {
          try {
            json = JSON.parse(rawText);
          } catch {
            // Tunnel returned HTML reminder/handshake during initial handshake
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 350));
              continue;
            }
            throw new Error(`Server returned non-JSON response (${res.status})`);
          }
        } else {
          json = {};
        }

        if (!res.ok) {
          const error: any = new Error(json.error || `Request failed with status ${res.status}`);
          error.status = res.status;
          throw error;
        }

        return json;
      } catch (err: any) {
        lastError = err;
        // Don't retry user credential/validation errors (e.g. wrong password 401)
        if (err.status && err.status < 500) {
          throw err;
        }
      }
    }
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 350 * attempt));
    }
  }

  throw new Error(lastError?.message || `API unreachable at ${baseUrl}. Check server status.`);
}

export const commandKey = () => Crypto.randomUUID();

