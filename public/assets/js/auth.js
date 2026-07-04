/**
 * Autenticação e Controle de Acesso
 */

const Auth = {
    // Verificar se está logado
    checkLogin: () => {
        const user = Storage.getCurrentUser();
        if (!user) {
            // Se não estiver na página de login, redirecionar
            if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
                window.location.href = 'index.html';
            }
        } else {
            // Se estiver logado e na página de login, redirecionar para a home correta
            if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                Auth.redirectUser(user);
            }
        }
    },

    // Redirecionar usuário baseado no papel
    redirectUser: (user) => {
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'user.html';
        }
    },

    // Realizar Login
    login: async (username, password) => {
        const user = await Storage.login(username, password);
        if (user) {
            Auth.redirectUser(user);
            return true;
        }
        return false;
    },

    // Realizar Cadastro
    register: async (name, username, password) => {
        try {
            const user = await Storage.registerUser(name, username, password);
            if (user) {
                // Auto-login após cadastro
                Storage.saveUserSession(user);
                Auth.redirectUser(user);
                return true;
            }
            return false;
        } catch (error) {
            throw error;
        }
    },

    // Realizar Logout
    logout: () => {
        Storage.logout();
        window.location.href = 'index.html';
    },

    // Verificar permissão de admin
    requireAdmin: () => {
        const user = Storage.getCurrentUser();
        if (!user || user.role !== 'admin') {
            alert('Acesso negado. Apenas administradores.');
            window.location.href = 'index.html';
        }
    }
};
