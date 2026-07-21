# Design System — Aurora

## Princípios de UI/UX

1. **Marca primeiro** — o logo/selo Aurora é o sinal dominante do primeiro viewport.
2. **Clean profissional** — espaço generoso, tipografia hierárquica, poucos elementos por seção.
3. **Uma função por seção** — Hero, Sobre, Produtos, Encomendas, Contato.
4. **Motion leve** — fade/rise no scroll + parallax sutil no hero (sem sobrecarregar).
5. **Canal de pedido claro** — Instagram como CTA principal ([@a.aurora.confeitaria](https://www.instagram.com/a.aurora.confeitaria/)).

## Tokens CSS

Definidos em `frontend/src/styles/tokens.css`:

- `--color-pink` / `--color-brown` / `--color-cream`
- `--font-brand` / `--font-display` / `--font-body`
- `--radius-*`, `--space-*`, `--shadow-*`

## Componentes

| Componente | Papel |
|------------|--------|
| `Button` | Primário (chocolate), secundário (rosa), ghost |
| `Header` | Nav fixa limpa, CTA Instagram |
| `Hero` | Full-bleed + parallax + logo selo |
| `About` | História / feito com amor |
| `Products` | Lista editorial (sem cards pesados) |
| `Order` | Passo a passo de encomenda |
| `Contact` | Formulário → API |
| `Footer` | Identidade + contato |

## Acessibilidade

- Contraste chocolate sobre creme
- `prefers-reduced-motion` desliga parallax/animações
- Labels semânticos no formulário
