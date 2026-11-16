// Membuat "NutriCare Server.exe": satu berkas yang bisa diklik dua kali,
// membuka jendela CMD berisi log server, tanpa perlu install Node.js.
//
// Cara pakai (di folder server/):
//   npm run build:exe
//
// Hasil: <folder rilis>/NutriCare Server.exe
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, '..');
const rootDir = resolve(serverDir, '..');
const buildDir = join(serverDir, 'build');
const blobPath = join(buildDir, 'sea-prep.blob');
const exePath = join(rootDir, 'NutriCare Server.exe');
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const langkah = (teks) => console.log(`• ${teks}`);

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });

langkah('Membundel kode server menjadi satu berkas...');
await build({
  entryPoints: [join(serverDir, 'src/main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: join(buildDir, 'app.cjs'),
  // Modul opsional yang tidak dipakai di Windows: biarkan dicari saat runtime.
  external: ['pg-native', 'pg-cloudflare', 'bufferutil', 'utf-8-validate'],
  legalComments: 'none',
  logLevel: 'error',
});

langkah('Menyiapkan blob Node SEA...');
writeFileSync(
  join(buildDir, 'sea-config.json'),
  JSON.stringify(
    {
      main: 'build/app.cjs',
      output: 'build/sea-prep.blob',
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
      useSnapshot: false,
    },
    null,
    2
  )
);
execFileSync(process.execPath, ['--experimental-sea-config', join(buildDir, 'sea-config.json')], {
  cwd: serverDir,
  stdio: 'inherit',
});

langkah('Menyalin runtime Node ke berkas .exe...');
copyFileSync(process.execPath, exePath);

langkah('Menyisipkan aplikasi ke dalam .exe...');
// Jalankan postject lewat Node langsung: nama berkas memuat spasi, dan shell
// Windows akan memecah argumen bila dipanggil lewat npx.
const postjectCli = join(serverDir, 'node_modules', 'postject', 'dist', 'cli.js');
if (!existsSync(postjectCli)) {
  throw new Error('postject belum terpasang. Jalankan: npm i -D postject');
}
execFileSync(
  process.execPath,
  [postjectCli, exePath, 'NODE_SEA_BLOB', blobPath, '--sentinel-fuse', FUSE],
  { cwd: serverDir, stdio: 'inherit' }
);

if (!existsSync(exePath)) throw new Error('Gagal membuat .exe');
const mb = (statSync(exePath).size / 1024 / 1024).toFixed(1);
console.log(`\n✅ Selesai: ${exePath} (${mb} MB)`);
console.log('   Klik dua kali berkas itu untuk menjalankan server.');
