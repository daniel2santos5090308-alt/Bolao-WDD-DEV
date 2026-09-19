import type { AppRoute } from '../app/routes';

const pageContent: Record<AppRoute, { eyebrow: string; title: string; body: string }> = {
  jogos: {
    eyebrow: 'Central da temporada',
    title: 'Jogos e apostas',
    body: 'Tela principal de palpites da temporada.'
  },
  ranking: {
    eyebrow: 'Ranking 2027',
    title: 'Rankings consolidados',
    body: 'Esta area vai concentrar ranking geral, ranking da rodada, cravadas e historico sem precisar rolar toda a lista de jogos.'
  },
  coins: {
    eyebrow: 'WDD Coins',
    title: 'Carteira e recompensas',
    body: 'Esta area sera preparada para saldo, extrato paginado, ranking de moedas e recompensas por rodada finalizada.'
  },
  perfil: {
    eyebrow: 'Perfil',
    title: 'Identidade do participante',
    body: 'Aqui ficarao nome publico, foto, time do coracao, estatisticas, skins equipadas e historico por temporada.'
  },
  admin: {
    eyebrow: 'Administracao',
    title: 'Painel admin 2027',
    body: 'Esta area vai receber temporadas, rodadas, partidas, resultados, configuracoes de pontuacao, Coins e auditoria.'
  }
};

interface PlaceholderPageProps {
  route: AppRoute;
}

export function PlaceholderPage({ route }: PlaceholderPageProps) {
  const content = pageContent[route];

  return (
    <section className="placeholder-page">
      <span className="eyebrow">{content.eyebrow}</span>
      <h1>{content.title}</h1>
      <p>{content.body}</p>
    </section>
  );
}
