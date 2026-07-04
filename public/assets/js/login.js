/**
 * Lógica de Login
 */
document.addEventListener('DOMContentLoaded', async () => {
    Storage.ensureAdminExists().then(created => {
        if (created) console.log('Admin nativo verificado/criado.');
    });

    Auth.checkLogin();

    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value.trim();
        const errorDiv = document.getElementById('loginError');
        const btn = loginForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;

        if (errorDiv) errorDiv.classList.add('d-none');

        try {
            btn.textContent = 'Entrando...';
            btn.disabled = true;

            const success = await Auth.login(user, pass);

            if (!success) {
                if (errorDiv) {
                    errorDiv.textContent = 'Usuário ou senha incorretos.';
                    errorDiv.classList.remove('d-none');
                }
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            if (errorDiv) {
                errorDiv.textContent = 'Erro ao conectar. Verifique o console.';
                errorDiv.classList.remove('d-none');
            }
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
});
