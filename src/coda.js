const http = require('http');
const https = require('https');
const tls = require('tls');

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 1090;

function isLocal() {
  return !process.env.RENDER && !process.env.HEROKU && !process.env.VERCEL && !process.env.PRODUCTION;
}

function directRequest(method, apiPath, payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'coda.io',
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${process.env.CODA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`Coda API ${res.statusCode}: ${data}`));
        resolve(JSON.parse(data || '{}'));
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function proxyRequest(method, apiPath, payload) {
  return new Promise((resolve, reject) => {
    const proxyReq = http.request({
      hostname: PROXY_HOST,
      port: PROXY_PORT,
      method: 'CONNECT',
      path: 'coda.io:443',
    });

    proxyReq.on('connect', (_, socket) => {
      const tlsSocket = tls.connect({ host: 'coda.io', socket, servername: 'coda.io' }, () => {
        let raw = `${method} ${apiPath} HTTP/1.1\r\n`;
        raw += `Host: coda.io\r\n`;
        raw += `Authorization: Bearer ${process.env.CODA_API_TOKEN}\r\n`;
        raw += `Content-Type: application/json\r\n`;
        if (payload) raw += `Content-Length: ${Buffer.byteLength(payload)}\r\n`;
        raw += `Connection: close\r\n\r\n`;
        if (payload) raw += payload;

        tlsSocket.write(raw);
        let data = '';
        tlsSocket.on('data', (c) => (data += c));
        tlsSocket.on('end', () => {
          const parts = data.split('\r\n\r\n');
          const statusCode = parseInt(parts[0].split('\r\n')[0].split(' ')[1]);
          const body = parts.slice(1).join('\r\n\r\n');
          if (statusCode >= 400) return reject(new Error(`Coda API ${statusCode}: ${body}`));
          resolve(JSON.parse(body || '{}'));
        });
      });

      tlsSocket.on('error', reject);
    });

    proxyReq.on('error', reject);
    proxyReq.end();
  });
}

function codaRequest(method, apiPath, body) {
  const payload = body ? JSON.stringify(body) : null;
  if (isLocal()) return proxyRequest(method, apiPath, payload);
  return directRequest(method, apiPath, payload);
}

const COLUMNS = {
  titulo: 'c-i_5qDXRqr4',
  descricao: 'c-9lQcrCnLiO',
  origem: 'c-agWzA66FUf',
  categoria: 'c-zpXamxAN4R',
  prioridade: 'c-jktpi_TUvl',
};

let colMapCache = null;

async function getColumnMap() {
  if (colMapCache) return colMapCache;
  const { CODA_DOC_ID, CODA_TABLE_ID } = process.env;
  const res = await codaRequest('GET', `/apis/v1/docs/${CODA_DOC_ID}/tables/${CODA_TABLE_ID}/columns`);
  colMapCache = {};
  for (const col of res.items) {
    colMapCache[col.name.toLowerCase()] = col.id;
  }
  return colMapCache;
}

async function enviarTarefa(dados) {
  const { CODA_API_TOKEN, CODA_DOC_ID, CODA_TABLE_ID } = process.env;
  if (!CODA_API_TOKEN || !CODA_DOC_ID || !CODA_TABLE_ID) {
    throw new Error('CODA_API_TOKEN, CODA_DOC_ID e CODA_TABLE_ID devem estar configurados no .env');
  }

  const colMap = await getColumnMap();
  const apiPath = `/apis/v1/docs/${CODA_DOC_ID}/tables/${CODA_TABLE_ID}/rows`;

  const cells = [];
  const add = (id, value) => { if (id && value) cells.push({ column: id, value }); };

  add(COLUMNS.titulo, dados.titulo);
  add(COLUMNS.descricao, dados.descricao);
  add(COLUMNS.origem, dados.origem || 'WhatsApp');
  add(COLUMNS.categoria, dados.categoria || 'Atendimento');
  add(COLUMNS.prioridade, dados.prioridade || 'Média');
  add(colMap['status'], dados.status || 'Entrada');
  add(colMap['contato'], dados.contato);
  add(colMap['data limite'], dados.dataLimite);
  add(colMap['próxima ação'] || colMap['proxima acao'], dados.proximaAcao);
  add(colMap['observações'] || colMap['observacoes'], dados.observacoes);

  await codaRequest('POST', apiPath, { rows: [{ cells }] });
}

module.exports = { enviarTarefa };
