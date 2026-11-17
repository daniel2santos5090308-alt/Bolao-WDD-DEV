/** Escudos e nomes canonicos dos times. */

const TEAM_LOGOS: Record<string, string> = {
  'Avaí': 'https://ssl.gstatic.com/onebox/media/sports/logos/9cwCmoBXGaPJ_Q5cgUeocg_48x48.png',
  'Athletico-PR': 'https://ssl.gstatic.com/onebox/media/sports/logos/LtpA9v-CQ_Qs2bgWVdDXxQ_48x48.png',
  'Atlético-MG': 'https://ssl.gstatic.com/onebox/media/sports/logos/q9fhEsgpuyRq58OgmSndcQ_48x48.png',
  'Bahia': 'https://ssl.gstatic.com/onebox/media/sports/logos/nIdbR6qIUDyZUBO9vojSPw_48x48.png',
  'Botafogo': 'https://ssl.gstatic.com/onebox/media/sports/logos/KLDWYp-H8CAOT9H_JgizRg_48x48.png',
  'Ceará': 'https://ssl.gstatic.com/onebox/media/sports/logos/mSl0cz3i2t8uv4zcprobOg_48x48.png',
  'Chapecoense': 'https://ssl.gstatic.com/onebox/media/sports/logos/cZ4ga5Fdqe3Pd-dEcpjUmg_48x48.png',
  'Coritiba': 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Coritiba_Foot_Ball_Club_logo.svg',
  'Corinthians': 'https://ssl.gstatic.com/onebox/media/sports/logos/tCMSqgXVHROpdCpQhzTo1g_48x48.png',
  'Cruzeiro': 'https://ssl.gstatic.com/onebox/media/sports/logos/cfkLbPGt7TD_FSDotajcbA_48x48.png',
  'CSA': 'https://ssl.gstatic.com/onebox/media/sports/logos/xQkyuz2y935JX0uIi9w6Lg_48x48.png',
  'Flamengo': 'https://ssl.gstatic.com/onebox/media/sports/logos/orE554NToSkH6nuwofe7Yg_48x48.png',
  'Fluminense': 'https://ssl.gstatic.com/onebox/media/sports/logos/fCMxMMDF2AZPU7LzYKSlig_48x48.png',
  'Fortaleza': 'https://ssl.gstatic.com/onebox/media/sports/logos/me10ephzRxdj45zVq1Risg_48x48.png',
  'Goiás': 'https://ssl.gstatic.com/onebox/media/sports/logos/gb8bo2x00XsbvsVp9nGniA_48x48.png',
  'Grêmio': 'https://ssl.gstatic.com/onebox/media/sports/logos/Ku-73v_TW9kpex-IEGb0ZA_48x48.png',
  'Internacional': 'https://ssl.gstatic.com/onebox/media/sports/logos/OWVFKuHrQuf4q2Wk0hEmSA_48x48.png',
  'Mirassol': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png',
  'Palmeiras': 'https://ssl.gstatic.com/onebox/media/sports/logos/7spurne-xDt2p6C0imYYNA_48x48.png',
  'RB Bragantino': 'https://cdn.prod.website-files.com/68f550992570ca0322737dc2/68f618a5ea5abd1cc4428b66_rb-bragantino-footballlogos-org.png',
  'Remo': 'https://cdn.prod.website-files.com/68f550992570ca0322737dc2/68fc0f795b927892ec59f2f9_clube-de-remo-footballlogos-org.png',
  'Santos': 'https://ssl.gstatic.com/onebox/media/sports/logos/VHdNOT6wWOw_vJ38GMjMzg_48x48.png',
  'São Paulo': 'https://ssl.gstatic.com/onebox/media/sports/logos/4w2Z97Hf9CSOqICK3a8AxQ_48x48.png',
  'Vasco': 'https://ssl.gstatic.com/onebox/media/sports/logos/_4RUqwd5euAxf0MtbPwq4A_48x48.png',
  'Vitória': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Esporte_Clube_Vit%C3%B3ria_%282024%29.svg'
};

const TEAM_ALIASES: Record<string, string> = {
  'Atletico-MG': 'Atlético-MG',
  'Atletico Mineiro': 'Atlético-MG',
  'Atlético Mineiro': 'Atlético-MG',
  'Atlético MG': 'Atlético-MG',
  'Athletico PR': 'Athletico-PR',
  'Athletico Paranaense': 'Athletico-PR',
  'Avai': 'Avaí',
  'Bragantino': 'RB Bragantino',
  'Clube do Remo': 'Remo',
  'Coritiba Foot Ball Club': 'Coritiba',
  'Goias': 'Goiás',
  'Gremio': 'Grêmio',
  'Inter-RS': 'Internacional',
  'Internacional-RS': 'Internacional',
  'Plameiras': 'Palmeiras',
  'RB Bragantino': 'RB Bragantino',
  'Red Bull Bragantino': 'RB Bragantino',
  'Vitoria': 'Vitória',
  'Sao Paulo': 'São Paulo',
  'Vasco da Gama': 'Vasco'
};

function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getCanonicalTeamName(teamName: string): string {
  const trimmed = String(teamName || '').trim();
  if (!trimmed) return '';
  if (TEAM_LOGOS[trimmed]) return trimmed;
  if (TEAM_ALIASES[trimmed]) return TEAM_ALIASES[trimmed];

  const target = normalizeText(trimmed);
  const direct = Object.keys(TEAM_LOGOS).find((name) => normalizeText(name) === target);
  if (direct) return direct;

  const alias = Object.keys(TEAM_ALIASES).find((name) => normalizeText(name) === target);
  return alias ? TEAM_ALIASES[alias] : trimmed;
}

/** Time da lista oficial (tem escudo cadastrado), depois de aplicar os apelidos. */
export function isKnownTeam(teamName: string): boolean {
  return Boolean(TEAM_LOGOS[getCanonicalTeamName(teamName)]);
}

/** Mesmo time, escrito de jeitos diferentes ("Vasco" e "Vasco da Gama"). */
export function isSameTeam(a: string, b: string): boolean {
  return normalizeText(getCanonicalTeamName(a)) === normalizeText(getCanonicalTeamName(b));
}

export function getTeamLogoUrl(teamName: string): string | null {
  return TEAM_LOGOS[getCanonicalTeamName(teamName)] || null;
}

export function getTeamInitials(teamName: string): string {
  const words = String(teamName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase();
}
