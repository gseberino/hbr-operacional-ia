import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const port = 4199;
const dbPath = join(process.cwd(), 'data', 'smoke-test.sqlite');

for (const suffix of ['', '-wal', '-shm']) {
  const file = `${dbPath}${suffix}`;
  if (existsSync(file)) rmSync(file);
}

const server = spawn(process.execPath, ['src/server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), HBR_DB_PATH: dbPath },
  stdio: ['ignore', 'pipe', 'pipe']
});

async function stop() {
  if (!server.killed) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (existsSync(file)) rmSync(file);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`http://localhost:${port}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`);
  return { response, data };
}

function cookieFrom(response) {
  return response.headers.get('set-cookie')?.split(';')[0] || '';
}

async function waitForServer() {
  for (let index = 0; index < 30; index += 1) {
    try {
      await request('/api/setup/status');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error('Servidor de teste nao respondeu.');
}

try {
  await waitForServer();
  const setup = await request('/api/setup/status');
  if (!setup.data.needsSetup) throw new Error('Setup deveria estar pendente no banco temporario.');

  await request('/api/setup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Teste HBR', email: 'teste@hbr.local', password: 'senha-teste-123' })
  });

  const login = await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'teste@hbr.local', password: 'senha-teste-123' })
  });
  const cookie = cookieFrom(login.response);

  const client = await request('/api/clients', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ name: 'Cliente Smoke', type: 'pessoa_fisica' })
  });

  const interpreted = await request('/api/intake/interpret', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      text: 'Temos orcamentos para enviar dia 08/05 pela manha. 2 deles para a embarcacao Aria, do cliente Marcelo Marco Bertoldi. da Madu do cliente Junior Rudec. Ainda para La Osadia, precisamos dar retorno para o Amarildo. OBS: segue: Marcelo MP Motorhomes, Celio Dondoka (prioridade), Sandro Motorhome.'
    })
  });
  if (!Array.isArray(interpreted.data.tasks) || interpreted.data.tasks.length < 5) {
    throw new Error('Interpretacao em lote deveria separar varias demandas.');
  }

  const task = await request('/api/tasks/from-intake', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      tasks: interpreted.data.tasks.slice(0, 2).map((item, index) => ({
        ...item,
        client_id: index === 0 ? client.data.id : item.client_id,
        selected: true
      }))
    })
  });

  const firstTaskId = task.data.tasks[0].id;
  const draft = await request(`/api/tasks/${firstTaskId}/drafts`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ type: 'email' })
  });

  await request(`/api/ai-actions/${draft.data.id}/approve`, {
    method: 'POST',
    headers: { Cookie: cookie }
  });

  const dashboard = await request('/api/dashboard', { headers: { Cookie: cookie } });
  if (dashboard.data.counts.tasks !== 2 || dashboard.data.counts.clients < 1) {
    throw new Error('Dashboard nao refletiu os registros temporarios.');
  }

  console.log('Smoke test OK');
} finally {
  await stop();
}
