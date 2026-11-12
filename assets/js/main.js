/*
 * Pozea landing page: waitlist form
 *
 * Saat ini form hanya memvalidasi email lalu menampilkan pesan sukses.
 * Untuk benar-benar menyimpan email dan mengirim notifikasi ke pendaftar,
 * isi WAITLIST_ENDPOINT dengan URL dari layanan form/email yang kamu pakai
 * (mis. Formspree, Brevo, MailerLite, atau API milikmu sendiri).
 * Data dikirim sebagai JSON: { "email": "..." }
 */
const WAITLIST_ENDPOINT = ''; // contoh: 'https://formspree.io/f/xxxxxxx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function showJoined() {
  document.querySelectorAll('.js-wl-form').forEach((el) => (el.hidden = true));
  document.querySelectorAll('.js-wl-done').forEach((el) => (el.hidden = false));
}

async function submitEmail(email) {
  if (!WAITLIST_ENDPOINT) return true; // belum disambungkan: anggap sukses
  const res = await fetch(WAITLIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.ok;
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
