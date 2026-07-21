import { useReveal } from '../../hooks/useReveal';
import './About.css';

export function About() {
  const { ref, visible } = useReveal<HTMLElement>();

  return (
    <section className="section about" id="sobre" ref={ref}>
      <div className={`container about__grid ${visible ? 'is-visible' : ''}`}>
        <div className="about__media reveal">
          <img
            src="/products/4c3b51e1-88fc-473a-a06d-e3f13e31c525.jpg"
            alt="Sandubrownie de morango da Aurora"
          />
        </div>

        <div className="about__copy">
          <p className="section__eyebrow reveal reveal-delay-1">Nossa história</p>
          <h2 className="section__title reveal reveal-delay-1">
            Feito para adoçar a sua <em>história</em>
          </h2>
          <div className="about__text reveal reveal-delay-2">
            <p>
              A Aurora Confeitaria nasceu do sonho de transformar momentos
              simples em lembranças especiais.
            </p>
            <p>
              Cada receita é preparada artesanalmente, com ingredientes
              selecionados, muito carinho e a dedicação de quem acredita que um
              doce pode tornar o dia de alguém mais feliz.
            </p>
            <p>
              Mais do que vender sobremesas, queremos criar experiências: aquele
              café da tarde em família, a comemoração inesperada, o presente
              dado com carinho ou a pausa merecida depois de um dia corrido.
            </p>
            <p>
              Também acreditamos em fazer a diferença onde estamos. Sempre que
              possível, buscamos apoiar ações que beneficiem nossa comunidade,
              porque acreditamos que compartilhar o bem faz parte da nossa
              essência.
            </p>
            <p>
              Seja bem-vindo à Aurora Confeitaria. Aqui, cada detalhe é feito
              para adoçar a sua história.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
