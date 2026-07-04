/**
 * Lógica de Login e Cadastro
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Garantir que Admin exista (Nativo)
    // Executa silenciosamente ao carregar a página
    Storage.ensureAdminExists().then(created => {
        if (created) console.log("Admin nativo verificado/criado.");
    });

    // 2. Verificar se já está logado
    Auth.checkLogin();

    // 3. Lógica de Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('username').value.trim();
            const pass = document.getElementById('password').value.trim();
            const errorDiv = document.getElementById('loginError');

            if (errorDiv) errorDiv.classList.add('d-none');
            
            try {
                const btn = loginForm.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
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
                const btn = loginForm.querySelector('button[type="submit"]');
                if (btn) {
                    btn.textContent = 'Entrar';
                    btn.disabled = false;
                }
            }
        });
    }

    // 4. Lógica de Modal de Cadastro
    const btnOpenRegister = document.getElementById('btnOpenRegister');
    if (btnOpenRegister) {
        btnOpenRegister.addEventListener('click', (e) => {
            e.preventDefault();
            const modalEl = document.getElementById('registerModal');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        });
    }

    // 5. Lógica de Cadastro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('regName').value.trim();
            const user = document.getElementById('regUser').value.trim();
            const pass = document.getElementById('regPass').value.trim();
            const errorDiv = document.getElementById('registerError');

            if (errorDiv) errorDiv.classList.add('d-none');

            if (!name || !user || !pass) {
                alert("Preencha todos os campos.");
                return;
            }

            try {
                const btn = registerForm.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.textContent = 'Criando conta...';
                btn.disabled = true;

                const success = await Auth.register(name, user, pass);

                if (success) {
                    // Auth.register já redireciona, mas por segurança:
                    alert("Conta criada com sucesso! Redirecionando...");
                    // Redirecionamento acontece em Auth.register
                } else {
                    // Caso raro onde retorna false sem erro
                    throw new Error("Não foi possível criar a conta.");
                }

            } catch (err) {
                console.error(err);
                if (errorDiv) {
                    errorDiv.textContent = err.message || "Erro ao criar conta.";
                    errorDiv.classList.remove('d-none');
                }
                const btn = registerForm.querySelector('button[type="submit"]');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
});