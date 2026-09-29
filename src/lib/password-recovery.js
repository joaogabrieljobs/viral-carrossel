async function post(path, body) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível concluir. Tente novamente.'), { code: data.code });
  return data;
}

export const requestPasswordReset = email => post('/api/auth/forgot-password', { email });
export const submitPasswordReset = (token, password, confirmPassword) => post('/api/auth/reset-password', { token, password, confirmPassword });
