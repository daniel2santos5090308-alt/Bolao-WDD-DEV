/**
 * Utilitários para o sistema de Bolão
 */

const Utils = {
    // Gerar ID único simples
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Formatar data para exibição (DD/MM/YYYY)
    formatDate: (dateString) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    },

    // Formatar data e hora para exibição
    formatDateTime: (dateString, timeString) => {
        if (!dateString || !timeString) return '';
        return `${Utils.formatDate(dateString)} às ${timeString}`;
    },

    // Criar objeto Date a partir de string de data e hora
    createDateObj: (dateString, timeString) => {
        return new Date(`${dateString}T${timeString}`);
    },

    // Verificar se o jogo já começou (bloqueio de apostas)
    isMatchLocked: (dateString, timeString) => {
        const now = new Date();
        const matchDate = Utils.createDateObj(dateString, timeString);
        return now >= matchDate;
    },

    // Formatar moeda ou decimal
    formatDecimal: (num) => {
        return parseFloat(num).toFixed(2);
    },

    // Escapar texto antes de inserir em HTML gerado por template string
    escapeHtml: (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Mostrar alerta (usando Toast ou Alert simples do navegador por enquanto, pode ser melhorado com Bootstrap)
    showAlert: (message, type = 'success') => {
        // Implementação simples com alert padrão para garantir funcionalidade
        // Num sistema real, usaríamos Toasts do Bootstrap
        alert(message);
    },

    // Hash SHA-256 para senhas
    hashPassword: async (message) => {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
};
