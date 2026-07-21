# Arquitetura — Aurora Confeitaria

Monorepo com **dois módulos deployáveis de forma independente**, alinhados à Clean Architecture e aos princípios SOLID.

## Visão geral

```
aurora_confeitaria/
├── frontend/     # SPA React (Vite) — UI, design system, consumo da API
├── backend/      # API Node.js (Express + TS) — regras de negócio e dados
└── docs/         # Documentação
```

## Camadas (Clean Architecture)

Ambos os módulos seguem a mesma divisão de responsabilidades:

| Camada | Responsabilidade | Depende de |
|--------|------------------|------------|
| **Domain** | Entidades e contratos (interfaces de repositório) | Nada |
| **Application** | Casos de uso (regras de aplicação) | Domain |
| **Infrastructure** | Persistência, HTTP client/server, adapters | Application + Domain |
| **Presentation** | Controllers/rotas (API) ou componentes (UI) | Application |

### SOLID na prática

- **S** — Cada caso de uso tem uma responsabilidade (ex.: `ListProducts`, `CreateContactMessage`).
- **O** — Novos canais (WhatsApp, e-mail) entram via novos adapters sem alterar use cases.
- **L** — Repositórios em memória e futuros (MySQL/Postgres) implementam a mesma interface.
- **I** — Interfaces pequenas (`IProductRepository`, `IContactRepository`).
- **D** — Controllers e use cases dependem de abstrações, não de Express/fs.

## Deploy Hostinger (separado)

### Frontend (site estático)

1. `npm run build:frontend`
2. Conteúdo de `frontend/dist/` → `public_html/` (ou subdomínio)
3. Variável `VITE_API_URL` aponta para a URL da API

### Backend (Node.js)

1. `npm run build:backend`
2. Upload de `backend/` (ou artefato build) no app Node.js Hostinger
3. `npm start` com `NODE_ENV=production`
4. Configurar `PORT`, `CORS_ORIGIN`, `NODE_ENV`

Veja `docs/DEPLOY_HOSTINGER.md` para o passo a passo.
