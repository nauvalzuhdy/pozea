/*
 * Pozea landing page: waitlist form
 *
 * Email dikirim ke form langganan Brevo (Contacts → Forms).
 * Brevo menyimpan email di list waitlist dan mengirim email konfirmasi ke pendaftar.
 * WAITLIST_ENDPOINT adalah atribut action dari kode embed form Brevo.
 * Kosongkan untuk mode uji tanpa menyimpan email.
 */
const WAITLIST_ENDPOINT =
  'https://c39111ca.sibforms.com/serve/MUIFADHBGLuBcLYo_37CSqVvfEK9JkGQBHDso79EI7lX4cq_bPTQI52mpPkdhatn7T_ANymMN_AnGOCMHIWLIeW8oLeZYxcuH6cYkv_Eh08Sidw7uLEet7aY-v7JDjH2nfJhQatA084TX-DNYxGERXhPDOI6k0NA5E7UVhpTk5pVucuKsWJWIPIq49BEfrLsfCtct1xGOgZybmef4w==';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function showJoined() {
  document.querySelectorAll('.js-wl-form').forEach((el) => (el.hidden = true));
  document.querySelectorAll('.js-wl-done').forEach((el) => (el.hidden = false));
}

async function submitEmail(email) {
  if (!WAITLIST_ENDPOINT) return true; // belum disambungkan: anggap sukses
  // Kirim seperti form embed Brevo: FormData ke action + ?isAjax=1, balasan JSON { success }.
  const data = new FormData();
  data.append('EMAIL', email);
  data.append('email_address_check', ''); // honeypot anti-spam Brevo, harus kosong
  data.append('locale', 'en');
  const res = await fetch(`${WAITLIST_ENDPOINT}?isAjax=1`, { method: 'POST', body: data });
  if (!res.ok) return false;
  const json = await res.json().catch(() => ({}));
  return json.success === true;
}

document.querySelectorAll('form.js-waitlist').forEach((form) => {
  const wrap = form.closest('.js-wl-form');
  const errorEl = wrap ? wrap.querySelector('.js-wl-error') : null;
  const input = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');

  const setError = (msg) => {
    if (!errorEl) return;
    errorEl.textContent = msg || '';
    errorEl.hidden = !msg;
  };

  input.addEventListener('input', () => setError(''));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!EMAIL_RE.test(email)) {
      setError('Masukkan alamat email yang valid.');
      input.focus();
      return;
    }
    button.disabled = true;
    try {
      const ok = await submitEmail(email);
      if (!ok) throw new Error('bad response');
      showJoined();
    } catch (err) {
      setError('Maaf, terjadi kesalahan. Coba lagi sebentar lagi.');
    } finally {
      button.disabled = false;
    }
  });
});
