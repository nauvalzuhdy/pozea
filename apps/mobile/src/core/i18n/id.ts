import type { Messages } from './en';

export const id: Messages = {
  common: {
    skip: 'Lewati',
    next: 'Lanjut',
    close: 'Tutup',
    comingSoon: 'Segera hadir',
    language: 'Bahasa',
  },
  onboarding: {
    welcome: {
      eyebrow: 'SELAMAT DATANG DI POZEA',
      titleStart: 'Nggak perlu bingung ',
      titleAccent: 'mau pose apa.',
      body: (count: number) =>
        `${count} pose untuk selfie dan foto seluruh badan, ditampilkan di figur tanpa wajah supaya gampang kamu tiru.`,
      cta: 'Mulai',
    },
    guide: {
      badge: 'PANDUAN POSE LANGSUNG',
      title: 'Ikuti garisnya, posenya pasti pas',
      body: 'Panduan muncul langsung di kamera. Sesuaikan badanmu dan selamat tinggal foto canggung.',
      cta: 'Lanjut',
    },
  },
  paywall: {
    heroOverline: 'Pozea PRO',
    heroTitle: 'Tanpa batas',
    heroSubtitle: 'semua fitur premium',
    tagline: 'Foto terbaikmu dimulai di sini.',
    choosePlan: 'Pilih paket',
    monthly: 'Bulanan',
    yearly: 'Tahunan',
    save: (percent: number) => `Hemat ${percent}%`,
    joinPro: 'Gabung Pozea Pro',
    features: {
      poses: 'Lebih banyak gaya dan pose premium, terus bertambah',
      editing: 'Editor lengkap: filter, retouch, crop, dan pencahayaan',
      hd: 'Kualitas Ultra HD, simpan foto dalam resolusi penuh',
    },
    cancelAnytime: (store: string) => `Bisa dibatalkan kapan saja di ${store}.`,
    cta: 'Mulai Perjalanan Fotomu',
    privacy: 'Kebijakan Privasi',
    terms: 'Syarat Penggunaan',
    restore: 'Pulihkan Pembelian',
    restoreNone: 'Belum ada pembelian untuk dipulihkan.',
  },
};
