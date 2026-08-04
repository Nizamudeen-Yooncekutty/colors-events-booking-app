import api from '@/lib/api';

export async function authenticateWithSSO(idToken) {
  const res = await api.post('/auth/sso', {}, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return res.data;
}
