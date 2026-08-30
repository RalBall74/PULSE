/**
 * PULSE Authentication View / Modal
 * Username + Password registration & login (no email required) with instant demo account switcher
 */

import { AuthService } from '../services/auth.js';
import { DatabaseService } from '../services/database.js';
import { Toast } from '../components/toast.js';
import { SoundService } from '../services/sounds.js';

let modalEl = null;

export const AuthView = {
  init() {
    modalEl = document.getElementById('modal-auth');
    if (!modalEl) return;
    this.bindEvents();
  },

  open(mode = 'LOGIN') {
    if (!modalEl) this.init();
    if (!modalEl) return;

    this.setMode(mode);
    modalEl.classList.add('open');
  },

  close() {
    if (modalEl) modalEl.classList.remove('open');
  },

  setMode(mode) {
    if (!modalEl) return;
    const isLogin = mode === 'LOGIN';
    
    modalEl.querySelector('#auth-modal-title').textContent = isLogin ? 'Sign In to PULSE' : 'Create Rival Account';
    modalEl.querySelector('#form-login').style.display = isLogin ? 'block' : 'none';
    modalEl.querySelector('#form-register').style.display = isLogin ? 'none' : 'block';
    modalEl.querySelector('#auth-toggle-prompt').innerHTML = isLogin
      ? `Don't have an account? <a href="#" id="btn-toggle-register" style="color: var(--accent-cyan); font-weight: 700;">Register</a>`
      : `Already have an account? <a href="#" id="btn-toggle-login" style="color: var(--accent-cyan); font-weight: 700;">Sign In</a>`;

    // Rebind toggles
    const regToggle = modalEl.querySelector('#btn-toggle-register');
    const logToggle = modalEl.querySelector('#btn-toggle-login');
    if (regToggle) regToggle.addEventListener('click', (e) => { e.preventDefault(); this.setMode('REGISTER'); });
    if (logToggle) logToggle.addEventListener('click', (e) => { e.preventDefault(); this.setMode('LOGIN'); });
  },

  bindEvents() {
    if (!modalEl) return;

    modalEl.querySelectorAll('.btn-close, .modal-backdrop-close').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Login Form
    const loginForm = modalEl.querySelector('#form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.querySelector('[name="username"]').value;
        const password = loginForm.querySelector('[name="password"]').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Authenticating...';

          await AuthService.login(username, password);
          SoundService.playClick();
          Toast.success('Welcome Back!', `Signed in as ${username}`);

          this.close();
          window.dispatchEvent(new CustomEvent('pulse_state_updated'));
        } catch (err) {
          Toast.error('Login Failed', err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        }
      });
    }

    // Register Form
    const registerForm = modalEl.querySelector('#form-register');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = registerForm.querySelector('[name="username"]').value;
        const password = registerForm.querySelector('[name="password"]').value;
        const confirmPassword = registerForm.querySelector('[name="confirmPassword"]').value;
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating Account...';

          await AuthService.register(username, password, confirmPassword);
          SoundService.playVictory();
          Toast.show({
            title: `Welcome, ${username}!`,
            message: 'Your account is ready. Challenge a rival on the dashboard!',
            type: 'xp'
          });

          this.close();
          window.dispatchEvent(new CustomEvent('pulse_state_updated'));
        } catch (err) {
          Toast.error('Registration Failed', err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Account';
        }
      });
    }

    // Demo Switcher Accounts (ApexLegend & VortexStriker)
    modalEl.querySelectorAll('.btn-quick-demo-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const username = btn.dataset.username;
        try {
          const user = await DatabaseService.getUserByUsername(username);
          if (user) {
            await AuthService.switchUser(user);
            SoundService.playClick();
            Toast.success('Switched Account', `Logged in as demo rival ${username}`);
            this.close();
            window.dispatchEvent(new CustomEvent('pulse_state_updated'));
          }
        } catch (err) {
          Toast.error('Switch Failed', err.message);
        }
      });
    });
  }
};
