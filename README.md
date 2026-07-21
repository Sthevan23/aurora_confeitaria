# Aurora Confeitaria Artesanal

Site + painel admin para Hostinger (HTML/CSS/JS + PHP + MySQL).

## Estrutura

- `index.html`, `style.css`, `script.js` — site público
- `products/` — fotos
- `js/` — dados padrão e storage (cache + sync com API)
- `admin/` — painel
- `api/` — API PHP ligada ao MySQL Hostinger

## Banco MySQL

- Domínio: `auroraconfeitaria.com.br`
- Banco: `u586160337_aurora_doces`
- SQL: `api/aurora_mysql.sql`
- Config: `api/config.local.php`
- Guia: `api/CONEXAO_HOSTINGER.txt`
- API: `api/data.php`

## Admin

- URL: `/admin/login.html`
- Email: `auroraconfeitaria2022@gmail.com`
- Senha: `aurora123`

## Subir na Hostinger

1. Importar `api/aurora_mysql.sql` no phpMyAdmin
2. Preencher senha em `api/config.local.php`
3. Enviar o site para `public_html`
4. Testar: `/api/data.php?ping=1`
