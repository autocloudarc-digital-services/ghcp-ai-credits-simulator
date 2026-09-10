import axios from 'axios';
import jwt from 'jsonwebtoken';
import { registerSettings } from '../register/store';

export function persistenceClient(role: 'application_sessions' | 'application_data', subject: string) {
  const { secret, url } = registerSettings();
  const token = jwt.sign({ role }, secret, { algorithm: 'HS256', subject, expiresIn: 60 });
  const client = axios.create({ baseURL: url, timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
  client.interceptors.response.use(response => response, error => {
    const conflict = ['23505', 'PT409'].includes(error.response?.data?.code);
    throw Object.assign(new Error(conflict ? 'Saved data changed. Reload before saving.' : 'Persistent storage is unavailable. No data was saved.'), { status: conflict ? 409 : 503 });
  });
  return client;
}