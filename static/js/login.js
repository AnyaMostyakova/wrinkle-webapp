// login.js - скрипт для страницы входа
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;

    const errorDiv = document.getElementById('errorMessage');
    errorDiv.classList.add('hidden');

    try {
        const response = await fetch('/login', {
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