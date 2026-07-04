/**
 * Mapeamento de escudos externos e helpers de exibicao dos times.
 */

const Teams = (() => {
    const teamLogos = {
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

    const aliases = {
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

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function getCanonicalName(teamName) {
        const trimmed = String(teamName || '').trim();
        if (!trimmed) return '';
        if (teamLogos[trimmed]) return trimmed;
        if (aliases[trimmed]) return aliases[trimmed];

        const normalizedTarget = normalizeText(trimmed);
        const directMatch = Object.keys(teamLogos).find(name => normalizeText(name) === normalizedTarget);
        if (directMatch) return directMatch;

        const aliasMatch = Object.keys(aliases).find(name => normalizeText(name) === normalizedTarget);
        return aliasMatch ? aliases[aliasMatch] : trimmed;
    }

    function getLogoUrl(teamName) {
        const canonicalName = getCanonicalName(teamName);
        return teamLogos[canonicalName] || null;
    }

    function getInitials(teamName) {
        const words = String(teamName || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (words.length === 0) return '?';
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase();
    }

    function getTeamMarkup(teamName, options = {}) {
        const size = options.size || 'md';
        const layout = options.layout || 'row';
        const className = options.className || '';
        const wrapperClass = `team-badge team-badge--${layout} ${className}`.trim();
        const safeName = escapeHtml(teamName || 'Time');
        const safeInitials = escapeHtml(getInitials(teamName));
        const logoUrl = getLogoUrl(teamName);
        const hiddenFallbackClass = logoUrl ? ' d-none' : '';
        const sizeMap = {
            sm: 28,
            md: 40,
            lg: 52
        };
        const dimension = sizeMap[size] || sizeMap.md;

        return `
            <div class="${wrapperClass}">
                ${logoUrl ? `
                    <img
                        src="${logoUrl}"
                        alt="Escudo do ${safeName}"
                        class="team-logo team-logo--${size}"
                        width="${dimension}"
                        height="${dimension}"
                        style="width:${dimension}px;height:${dimension}px;max-width:${dimension}px;max-height:${dimension}px;"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        onerror="this.style.display='none'; this.nextElementSibling.classList.remove('d-none');"
                    >
                ` : ''}
                <span class="team-logo-fallback team-logo--${size}${hiddenFallbackClass}">${safeInitials}</span>
                <span class="team-badge__name">${safeName}</span>
            </div>
        `;
    }

    return {
        getCanonicalName,
        getLogoUrl,
        getTeamMarkup
    };
})();
