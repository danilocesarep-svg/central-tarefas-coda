# Central de Tarefas - Coda

Formulário local para entrada rápida de tarefas no Coda. Cole mensagens do WhatsApp, e-mail ou crie tarefas manuais e envie direto para sua tabela "Tarefas" no Coda.

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo de exemplo e preencha com seus dados:

```bash
cp .env.example .env
```

2. No `.env`, configure:
   - `CODA_WEBHOOK_URL` — URL do webhook da sua tabela no Coda
   - `CODA_API_TOKEN` — Token de API do Coda (gere em https://coda.io/account)

## Uso

```bash
npm start
```

Acesse `http://localhost:3000` no navegador.

## Rotas

| Rota | Método | Descrição |
|------|--------|-----------|
| `/` | GET | Formulário de nova tarefa |
| `/nova-tarefa` | POST | Envia tarefa para o Coda |
| `/saude` | GET | Health check |

## Configuração no Coda

Crie uma tabela chamada "Tarefas" com as colunas:
- Título
- Descrição
- Origem
- Categoria
- Prioridade
- Status
- Contato
- Data Limite
- Próxima Ação
- Observações

Configure um webhook (Pack ou Automation) que receba os dados do formulário e insira linhas na tabela.
