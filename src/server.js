const http = require('http');
const { parse: parseUrl } = require('url');
const { parse: parseQuery } = require('querystring');
const fs = require('fs');
const path = require('path');
const { enviarTarefa } = require('./coda');

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}

const PORT = process.env.PORT || 3000;

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (req.headers['content-type']?.includes('json')) {
        resolve(JSON.parse(body));
      } else {
        resolve(parseQuery(body));
      }
    });
  });
}

const FORM_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova Tarefa</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #f0f2f5; padding: 16px; }
    h1 { font-size: 1.3rem; color: #1a1a2e; margin-bottom: 16px; text-align: center; }
    form { background: #fff; border-radius: 12px; padding: 20px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #444; margin-bottom: 4px; margin-top: 14px; }
    input, textarea, select {
      width: 100%; padding: 10px 12px; border: 1px solid #ddd;
      border-radius: 8px; font-size: 1rem; color: #222;
      background: #fafafa; transition: border 0.2s;
    }
    input:focus, textarea:focus, select:focus { outline: none; border-color: #4f46e5; background: #fff; }
    textarea { resize: vertical; min-height: 90px; }
    button[type=submit] {
      margin-top: 20px; width: 100%; padding: 13px;
      background: #4f46e5; color: #fff; border: none;
      border-radius: 8px; font-size: 1rem; font-weight: 700;
      cursor: pointer; transition: background 0.2s;
    }
    button[type=submit]:hover { background: #3730a3; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>&#128203; Nova Tarefa</h1>
  <form method="POST" action="/nova-tarefa">
    <label>T\u00edtulo *</label>
    <input type="text" name="titulo" placeholder="Resumo da tarefa" required>

    <label>Descri\u00e7\u00e3o *</label>
    <textarea name="descricao" placeholder="Cole aqui a mensagem do WhatsApp, e-mail ou descreva a tarefa..." required></textarea>

    <div class="row">
      <div>
        <label>Origem</label>
        <select name="origem">
          <option value="WhatsApp" selected>WhatsApp</option>
          <option value="E-mail">E-mail</option>
          <option value="Manual">Manual</option>
          <option value="Telefone">Telefone</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div>
        <label>Categoria</label>
        <select name="categoria">
          <option value="Atendimento" selected>Atendimento</option>
          <option value="Financeiro">Financeiro</option>
          <option value="Operacional">Operacional</option>
          <option value="Comercial">Comercial</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
    </div>

    <div class="row">
      <div>
        <label>Prioridade</label>
        <select name="prioridade">
          <option value="Alta">Alta</option>
          <option value="M\u00e9dia" selected>M\u00e9dia</option>
          <option value="Baixa">Baixa</option>
        </select>
      </div>
      <div>
        <label>Status</label>
        <select name="status">
          <option value="Entrada" selected>Entrada</option>
          <option value="Em andamento">Em andamento</option>
          <option value="Aguardando">Aguardando</option>
          <option value="Conclu\u00eddo">Conclu\u00eddo</option>
        </select>
      </div>
    </div>

    <div class="row">
      <div>
        <label>Contato</label>
        <input type="text" name="contato" placeholder="Nome ou n\u00famero">
      </div>
      <div>
        <label>Data Limite</label>
        <input type="date" name="dataLimite">
      </div>
    </div>

    <label>Pr\u00f3xima A\u00e7\u00e3o</label>
    <input type="text" name="proximaAcao" placeholder="O que precisa ser feito?">

    <label>Observa\u00e7\u00f5es</label>
    <textarea name="observacoes" placeholder="Informa\u00e7\u00f5es adicionais..." style="min-height:60px"></textarea>

    <button type="submit">Enviar Tarefa \u2192</button>
  </form>
</body>
</html>`;

const resultPage = (ok, msg) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ok ? 'Tarefa Enviada' : 'Erro'}</title>
  <style>
    body { font-family: sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; padding: 40px 32px; text-align: center; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .icon { font-size: 3rem; }
    h2 { margin: 12px 0 8px; color: ${ok ? '#1a1a2e' : '#b91c1c'}; }
    p { color: #666; margin-bottom: 24px; }
    a { display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; }
    a:hover { background: #3730a3; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? '&#9989;' : '&#10060;'}</div>
    <h2>${ok ? 'Tarefa enviada!' : 'Algo deu errado'}</h2>
    <p>${msg}</p>
    <a href="/">${ok ? 'Criar outra tarefa' : 'Tentar novamente'}</a>
  </div>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const { pathname } = parseUrl(req.url);

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(FORM_HTML);
  }

  if (req.method === 'GET' && pathname === '/saude') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  if (req.method === 'GET' && pathname === '/debug') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      CODA_API_TOKEN: process.env.CODA_API_TOKEN ? 'SET' : 'NOT SET',
      CODA_DOC_ID: process.env.CODA_DOC_ID || 'NOT SET',
      CODA_TABLE_ID: process.env.CODA_TABLE_ID || 'NOT SET',
      PRODUCTION: process.env.PRODUCTION || 'NOT SET',
    }));
  }

  if (req.method === 'POST' && pathname === '/nova-tarefa') {
    const body = await parseBody(req);

    if (!body.titulo?.trim() || !body.descricao?.trim()) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(resultPage(false, 'T\u00edtulo e descri\u00e7\u00e3o s\u00e3o obrigat\u00f3rios.'));
    }

    try {
      await enviarTarefa(body);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(resultPage(true, 'A tarefa foi registrada no Coda com sucesso.'));
    } catch (err) {
      console.error('Erro ao enviar para o Coda:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(resultPage(false, 'N\u00e3o foi poss\u00edvel enviar a tarefa. Verifique as configura\u00e7\u00f5es e tente novamente.'));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
