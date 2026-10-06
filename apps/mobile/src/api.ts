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
    } catch {}
  }

  // 6. Default LAN IP fallback
  return 'http://192.168.1.9:4000';
}

export const getToken = async () => Platform.OS === 'web' ? sessionStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);

export async function saveToken(token:string|null) {
  if(Platform.OS === 'web') { token ? sessionStorage.setItem(TOKEN_KEY,token) : sessionStorage.removeItem(TOKEN_KEY); return; }
  if(token) await SecureStore.setItemAsync(TOKEN_KEY,token); else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function request(path:string, token:string|null, body?:unknown) {
  const baseUrl = getApiBaseUrl();
  let res: Response | null = null;
  let primaryError: any = null;

  try {
    res = await fetch(baseUrl + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
  } catch (err: any) {
    primaryError = err;
    // Build list of alternative URLs to try if network fetch fails
    const fallbacks: string[] = [];
    if (!baseUrl.includes('192.168.1.9')) {
      fallbacks.push(`http://192.168.1.9:4000${path}`);
    }
    if (baseUrl.includes('localhost')) {
      fallbacks.push(`http://127.0.0.1:4000${path}`);
    } else if (baseUrl.includes('127.0.0.1')) {
      fallbacks.push(`http://localhost:4000${path}`);
    } else {
      fallbacks.push(`http://localhost:4000${path}`, `http://127.0.0.1:4000${path}`);
    }
    fallbacks.push(`http://10.0.2.2:4000${path}`);

    for (const altUrl of fallbacks) {
      try {
        const altRes = await fetch(altUrl, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(5000)
        });
        res = altRes;
        primaryError = null;
        break;
      } catch {}
    }
  }

  if (!res) {
    throw new Error(`API unreachable at ${baseUrl} (${primaryError?.message || 'Network request failed'}). Check server status or network connection.`);
  }

  const json = await res.json();
  if(!res.ok) { const error:any = new Error(json.error || 'Request failed'); error.status = res.status; throw error; }
  return json;
}

export const commandKey = () => Crypto.randomUUID();

