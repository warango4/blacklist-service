// Prueba de estrés (Entrega 4). Uso:
//   k6 run -e BASE_URL=http://<alb> -e TOKEN=<jwt> load-tests/stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const BASE_URL = __ENV.BASE_URL;
const TOKEN = __ENV.TOKEN;
const APP_UUID = '9f1c3a52-7d4b-4c1e-9a3f-2b8e6d0c1a77';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const AUTH = { ...JSON_HEADERS, Authorization: `Bearer ${TOKEN}` };

export const options = {
  scenarios: {
    carga: {
      executor: 'ramping-vus',
      exec: 'flujoNormal',
      stages: [
        { duration: '2m', target: 2 }, // calentamiento
        { duration: '1m', target: 10 },
        { duration: '5m', target: 10 }, // carga normal
        { duration: '4m', target: 50 }, // rampa de estrés
        { duration: '4m', target: 50 }, // estrés sostenido
        { duration: '2m', target: 0 }, // enfriamiento
      ],
    },
    errores: {
      executor: 'constant-arrival-rate',
      exec: 'peticionesInvalidas',
      rate: 1,
      timeUnit: '1s',
      duration: '18m',
      preAllocatedVUs: 5,
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

export function setup() {
  const res = http.get(`${BASE_URL}/blacklists/verificacion@stress.test`, { headers: AUTH });
  if (res.status !== 200) {
    exec.test.abort(`El token no es válido para ${BASE_URL} (HTTP ${res.status}). Revisa la variable TOKEN.`);
  }
}

export function flujoNormal() {
  const email = `vu${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${Date.now()}@stress.test`;

  const post = http.post(
    `${BASE_URL}/blacklists`,
    JSON.stringify({ email, app_uuid: APP_UUID, blocked_reason: 'prueba de estres' }),
    { headers: AUTH, tags: { name: 'POST /blacklists' } },
  );
  check(post, { 'POST 201': (r) => r.status === 201 });

  const found = http.get(`${BASE_URL}/blacklists/${email}`, { headers: AUTH, tags: { name: 'GET /blacklists/:email' } });
  check(found, { 'GET encontrado 200': (r) => r.status === 200 });

  const missing = http.get(`${BASE_URL}/blacklists/no-existe-${Date.now()}@stress.test`, {
    headers: AUTH,
    tags: { name: 'GET /blacklists/:email' },
  });
  check(missing, { 'GET no encontrado 200': (r) => r.status === 200 });

  const health = http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
  check(health, { 'health 200': (r) => r.status === 200 });

  sleep(1);
}

// Rota entre 401 (sin token y token inválido), 400 (cuerpo inválido) y 409 (email repetido).
export function peticionesInvalidas() {
  const tipo = exec.scenario.iterationInTest % 4;
  let res;
  if (tipo === 0) {
    res = http.get(`${BASE_URL}/blacklists/alguien@stress.test`, { tags: { name: 'error 401 sin token' } });
    check(res, { '401 sin token': (r) => r.status === 401 });
  } else if (tipo === 1) {
    res = http.get(`${BASE_URL}/blacklists/alguien@stress.test`, {
      headers: { Authorization: 'Bearer token-invalido' },
      tags: { name: 'error 401 token invalido' },
    });
    check(res, { '401 token invalido': (r) => r.status === 401 });
  } else if (tipo === 2) {
    res = http.post(`${BASE_URL}/blacklists`, JSON.stringify({ email: 'no-es-un-email', app_uuid: 'x' }), {
      headers: AUTH,
      tags: { name: 'error 400 cuerpo invalido' },
    });
    check(res, { '400 cuerpo invalido': (r) => r.status === 400 });
  } else {
    res = http.post(
      `${BASE_URL}/blacklists`,
      JSON.stringify({ email: 'repetido@stress.test', app_uuid: APP_UUID }),
      { headers: AUTH, tags: { name: 'error 409 repetido' } },
    );
    check(res, { '409 repetido (o 201 la primera vez)': (r) => r.status === 409 || r.status === 201 });
  }
}
