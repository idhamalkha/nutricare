# NutriCare Serverless

Varian deployment terpisah untuk Netlify dan Vercel. Backend utama Fastify tetap menjadi sumber logika; adapter serverless menjalankan aplikasi melalui `fastify.inject()` tanpa membuka port permanen. Supabase tetap menyediakan PostgreSQL, Auth, dan Storage.

## Prasyarat repo

Sebelum mendorong folder ini ke GitHub:

- Pastikan `.env`, `KREDENSIAL_LOGIN.txt`, token, dan connection string tidak ada di repo.
- Jangan menaruh rahasia di source/frontend atau di `public/`.
- Deploy hanya data demo. Aplikasi ini menangani data kesehatan; jangan gunakan data pasien nyata pada layanan free tier tanpa persetujuan dan penilaian privasi/keamanan yang sesuai.

## Variabel environment

Tambahkan di dashboard hosting, bukan ke file yang di-commit:

- `NODE_ENV=production`
- `AUTH_MODE=strict`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (gunakan Supabase Transaction Pooler)

`CORS_ORIGIN` hanya diperlukan bila frontend dan API ditempatkan pada origin yang berbeda. Untuk satu deployment gabungan, biarkan tidak disetel. `PORT` tidak diperlukan.

## Netlify

Buat site dari repository yang berisi folder ini sebagai root:

- Build settings dibaca dari `netlify.toml`.
- Build memasang dan mengompilasi server di `server/`.
- Static publish directory: `public/`.
- Semua `/api/*` diarahkan ke satu Netlify Function.
- Tambahkan variabel environment pada Site configuration → Environment variables, lalu deploy.

## Vercel

Buat project dengan folder ini sebagai root:

- Vercel memakai `vercel.json`.
- Build command mengompilasi backend; static output berasal dari `public/`.
- `api/[...path].ts` menjadi satu Node.js Function untuk `/api/*`.
- Tambahkan variabel environment pada Project → Settings → Environment Variables, lalu deploy ulang.

## Cek setelah deploy

Uji URL deployment:

1. `/api/health` harus mengembalikan status 200.
2. `/`, satu halaman seperti `/pages/ahli-gizi.html`, dan aset `/css/` serta `/js/` harus terbuka.
3. Endpoint API terlindungi tanpa token harus menolak request.
4. Tes login dan alur aplikasi dengan akun/data demo; jangan menjalankan tes mutasi pada database live tanpa rencana dan izin.
5. Jika deploy gagal, periksa build log. Jangan menyalin nilai environment variable ke issue, chat, atau log publik.

## Batasan dan status

Adapter berbagi server Fastify yang sama, namun fungsi hosting Netlify dan Vercel tetap dua wrapper terpisah. Ini menghindari porting semua route ke Supabase Edge Functions/Deno. Fungsi serverless dapat cold-start dan punya batas runtime/kuota sesuai paket. File ini belum berarti service sudah dideploy; setiap provider memerlukan repo GitHub dan variabel rahasia yang dikonfigurasi pemilik akun.
