/**
 * Autenticação e controle de acesso.
 */
const Auth = {
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
