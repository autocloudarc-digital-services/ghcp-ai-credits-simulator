import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * Attaches the server-issued double-submit CSRF token to every mutating
 * (POST/PUT/PATCH/DELETE) request made through the default axios instance.
 * The token is fetched lazily from GET /auth/csrf-token and cached in
 * memory; if the server ever rejects a request with 403 (e.g. because the
 * session was recreated), the token is refreshed once and the request is
 * retried. Imported once, as a side effect, from main.tsx.
 */

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = axios.get<{ csrfToken: string }>('/auth/csrf-token').then((res) => {
      csrfToken = res.data.csrfToken;
      csrfTokenPromise = null;
      return csrfToken;
    });
  }
  return csrfTokenPromise;
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _csrfRetried?: boolean;
}

axios.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase();
  if (method && MUTATING_METHODS.has(method)) {
    const token = csrfToken ?? (await fetchCsrfToken());
    config.headers.set('X-CSRF-Token', token);
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    if (error.response?.status === 403 && config && !config._csrfRetried) {
      config._csrfRetried = true;
      csrfToken = null;
      const token = await fetchCsrfToken();
      config.headers.set('X-CSRF-Token', token);
      return axios(config);
    }
    return Promise.reject(error);
  }
);
