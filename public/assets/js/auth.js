/**
 * Autenticação e controle de acesso.
 */
const Auth = {
    RETURN_TO_KEY: 'bolao_wdd_return_to',

    checkLogin: () => {
        const user = Storage.getCurrentUser();
        if (!user) {
            if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
                window.location.href = 'index.html';
            }
            return;
        }

        if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
            Auth.redirectUser(user);
        }
    },

    redirectUser: (user) => {
        const returnTo = localStorage.getItem(Auth.RETURN_TO_KEY);
        if (returnTo) {
            localStorage.removeItem(Auth.RETURN_TO_KEY);
            window.location.href = returnTo;
            return;
        }

        if (user.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }

        window.location.href = 'user.html';
    },

    login: async (username, password) => {
        const user = await Storage.login(username, password);
        if (!user) return false;

        Auth.redirectUser(user);
        return true;
    },

    logout: () => {
        Storage.logout();
        window.location.href = 'index.html';
    },

    requireAdmin: () => {
        const user = Storage.getCurrentUser();
        if (!user || user.role !== 'admin') {
            alert('Acesso negado. Apenas administradores.');
            window.location.href = 'index.html';
        }
    }
};
