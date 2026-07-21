import './MarqueeBanner.css';

const items = [
  'Feito com amor',
  'Copos Brownie',
  'Sandubrownies',
  'Cookies',
  'Potes',
  'Boa Esperança MG',
  'Aurora Confeitaria',
];

export function MarqueeBanner() {
  const loop = [...items, ...items, ...items, ...items];

  return (
    <section className="marquee" aria-hidden>
      <div className="marquee__scroller">
        <div className="marquee__track">
          {loop.map((item, index) => (
            <span key={`${item}-${index}`} className="marquee__item">
              {item}
              <span className="marquee__dot" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
