# Deploy Hostinger — Frontend e Backend separados

## Pré-requisitos

- Conta Hostinger com hospedagem que suporte **Node.js** (para a API)
- Domínio ou subdomínio (ex.: `aurora.com.br` + `api.aurora.com.br`)

## 1. Frontend (estático)

```bash
cd frontend
cp .env.example .env.production
# Edite VITE_API_URL=https://api.seudominio.com
npm install
npm run build
```

Envie o conteúdo de `frontend/dist/` para `public_html`.

No painel, configure redirecionamento SPA se necessário (todas as rotas → `index.html`).

## 2. Backend (Node.js)

```bash
cd backend
cp .env.example .env
# Edite PORT, CORS_ORIGIN, NODE_ENV=production
npm install
npm run build
```

No Hostinger Node.js App:

- **Start command:** `npm start`
- **Node version:** 20+
- **Root:** pasta `backend`
- Variáveis de ambiente iguais ao `.env`

## 3. CORS

`CORS_ORIGIN` no backend deve ser a URL pública do frontend (sem barra no final).

## Escala futura

- Trocar `InMemory*` / JSON file repositories por MySQL (Hostinger) implementando as mesmas interfaces em `domain/repositories`.
- CDN para imagens de produtos.
- Separar admin (CMS) como novo módulo frontend sem alterar o domain.
