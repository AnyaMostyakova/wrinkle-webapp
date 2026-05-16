// register.js - скрипт для страницы регистрации
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const errorDiv = document.getElementById('errorMessage');
    errorDiv.classList.add('hidden');

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Пароли не совпадают';
        errorDiv.classList.remove('hidden');
        return;
    }

    if (password.length < 4) {
        errorDiv.textContent = 'Пароль должен содержать минимум 4 символа';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ login, password })
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = '/dashboard';
        } else {
            errorDiv.textContent = data.message;
            errorDiv.classList.remove('hidden');
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения';
        errorDiv.classList.remove('hidden');
    }
});