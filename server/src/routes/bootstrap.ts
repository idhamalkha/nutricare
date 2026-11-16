// Endpoint gabungan untuk memuat data awal halaman dalam SATU permintaan.
//
// Sebelumnya halaman memanggil /api/pasien, /api/pantangan, /api/jadwal, dst.
// secara berurutan (XHR sinkron), sehingga setiap pindah halaman menunggu
// 6 round-trip database. Di sini semua resource dijalankan paralel di server.
import { FastifyInstance } from 'fastify';
import { checkPermission, requirePermission } from '../rbac.js';
import * as pasienModule from '../modules/pasien.js';
import * as pantanganModule from '../modules/pantangan.js';
import * as rekomendasiModule from '../modules/rekomendasi.js';
import * as jadwalModule from '../modules/jadwal.js';
import * as perawatModule from '../modules/perawat.js';
import * as bahanModule from '../modules/bahan.js';

type ResourceKey = Parameters<typeof requirePermission>[1];

type Loader = { perm: ResourceKey; load: (role: string) => Promise<unknown> };

const RESOURCES: Record<string, Loader> = {
  pasien: { perm: 'pasien', load: async () => pasienModule.getAllPasien() },
  pantangan: { perm: 'pantangan', load: async () => pantanganModule.getAllPantangan() },
  rekomendasi: { perm: 'rekomendasi', load: async () => rekomendasiModule.getAllRekomendasi() },
  jadwal: {
    perm: 'jadwal',
    load: async (role) =>
      role === 'waiter' ? jadwalModule.getReadyDistribution() : jadwalModule.getAllJadwal(),
  },
  perawat: { perm: 'perawat', load: async () => perawatModule.getAllLaporan() },
  bahan: { perm: 'bahan', load: async () => bahanModule.getAllBahan() },
};

export async function bootstrapRoutes(app: FastifyInstance) {
  app.get('/bootstrap', async (request, reply) => {
    const role = request.user.role;
    const raw = String((request.query as any)?.resources || '');
    const requested = raw
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key && RESOURCES[key]);

    const keys = requested.length ? [...new Set(requested)] : Object.keys(RESOURCES);

    const entries = await Promise.all(
      keys.map(async (key) => {
        // Role yang tidak berhak cukup dilewati, bukan menggagalkan seluruh muatan.
        if (!checkPermission(role, RESOURCES[key].perm, 'read')) return null;
        const value = await RESOURCES[key].load(role);
        return [key, value] as const;
      })
    );

    const payload: Record<string, unknown> = {};
    for (const entry of entries) {
      if (entry) payload[entry[0]] = entry[1];
    }

    return reply.send(payload);
  });
}
