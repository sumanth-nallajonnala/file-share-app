const API_URL = 'https://file-share-app-dbrm.onrender.com/api';

// Signup Form Handler
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const pin = document.getElementById('newPin').value;
        const confirmPin = document.getElementById('confirmPin').value;
        
        // Validation
        if (pin.length < 4 || pin.length > 6) {
            showMessage('signupMessage', '❌ PIN must be 4-6 digits!', 'error');
            return;
        }
        
        if (!/^\d+$/.test(pin)) {
            showMessage('signupMessage', '❌ PIN must contain only numbers!', 'error');
            return;
        }
        
        if (pin !== confirmPin) {
            showMessage('signupMessage', '❌ PINs do not match!', 'error');
            return;
        }
        
        // Show loading
        const submitBtn = signupForm.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account... ⏳';
        
        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pin })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Signup failed');
            }
            
            // Save token
            localStorage.setItem('authToken', data.token);
            
            showMessage('signupMessage', '✅ Account created! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
            
        } catch (error) {
            showMessage('signupMessage', `❌ ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Join the Club 🎉';
        }
    });
}

// Login Form Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const pin = document.getElementById('pin').value;
        
        // Validation
        if (!pin || pin.length < 4) {
            showMessage('loginMessage', '❌ Please enter a valid PIN!', 'error');
            return;
        }
        
        // Show loading
        const submitBtn = loginForm.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in... ⏳';
        
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pin })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            
            // Save token
            localStorage.setItem('authToken', data.token);
            
            showMessage('loginMessage', '✅ Welcome back! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
            
        } catch (error) {
            showMessage('loginMessage', `❌ ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Let Me In 🔓';
        }
    });
}

// Show Message Helper
function showMessage(elementId, message, type) {
    const msgElement = document.getElementById(elementId);
    if (msgElement) {
        msgElement.textContent = message;
        msgElement.className = `message ${type}`;
        
        setTimeout(() => {
            msgElement.className = 'message';
        }, 5000);
    }
}

// Check if user is already logged in (for auth pages)
if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
    const token = localStorage.getItem('authToken');
    if (token) {
        window.location.href = 'dashboard.html';
    }
}