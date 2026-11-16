// Entry point tunggal: dipakai oleh `npm start` maupun oleh .exe hasil bundel (Node SEA).
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { startServer } from './app.js';

// Saat berjalan sebagai .exe, process.execPath bukan node.exe.
const isPackaged = !process.execPath.toLowerCase().endsWith('node.exe');
const port = process.env.PORT || '3017';
const url = `http://localhost:${port}`;

function tahanJendela(pesan: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pesan, () => {
      rl.close();
      resolve();
    });
  });
}

function bukaBrowser(): void {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function main(): Promise<void> {
  try {
    await startServer();
  } catch (err) {
    const pesan = err instanceof Error ? err.message : String(err);
    console.error('');
    if (/EADDRINUSE/i.test(pesan)) {
      console.error(`❌ Port ${port} sudah dipakai aplikasi lain.`);
      console.error('   Tutup jendela NutriCare yang lain, atau ubah PORT di file .env.');
    } else {
      console.error(`❌ Server gagal dijalankan: ${pesan}`);
    }
    console.error('');
    // Jendela .exe akan menutup sendiri; tunggu Enter supaya pesan terbaca.
    if (isPackaged) await tahanJendela('Tekan Enter untuk menutup jendela ini...');
    process.exit(1);
  }

  console.log('');
  console.log(`   Buka di browser: ${url}`);
  console.log('   Biarkan jendela ini tetap terbuka selama aplikasi dipakai.');
  console.log('   Tekan Ctrl+C untuk menghentikan server.');
  console.log('');

  if (isPackaged && process.env.NUTRICARE_OPEN_BROWSER !== '0') {
    bukaBrowser();
  }

  // Jangan biarkan satu promise gagal mematikan layanan tanpa jejak.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err instanceof Error ? err.message : err);
  });
}

process.on('SIGINT', () => {
  console.log('\nServer dihentikan.');
  process.exit(0);
});

void main();
