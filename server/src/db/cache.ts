// Cache baca in-memory untuk endpoint GET.
//
// Alasan: database berada di region yang jauh (satu query ≈ 240 ms). Tanpa cache,
// setiap perpindahan halaman menunggu satu round-trip penuh. Dengan cache:
// - permintaan pertama tetap menunggu database,
// - permintaan berikutnya dilayani dari memori (≈ 0 ms) dan diperbarui di belakang
//   layar (stale-while-revalidate) setelah TTL lewat,
// - setiap operasi tulis memanggil invalidateAll() sehingga data tidak basi.

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export const DEFAULT_TTL_MS = 15_000;

async function load<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const promise = loader()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise as Promise<T>;
}

export function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key);

  if (hit) {
    if (hit.expires > Date.now()) return Promise.resolve(hit.value as T);

    // Data kedaluwarsa: layani versi lama, segarkan di belakang layar.
    if (!inflight.has(key)) {
      void load(key, ttlMs, loader).catch(() => {
        store.delete(key);
      });
    }
    return Promise.resolve(hit.value as T);
  }

  return load(key, ttlMs, loader);
}

// Hapus entri yang kuncinya diawali prefix (mis. 'pasien').
export function invalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key === prefix || key.startsWith(`${prefix}:`)) store.delete(key);
  }
}

// Dipakai setelah operasi tulis: buang semua cache baca.
export function invalidateAll(): void {
  store.clear();
}

export function cacheStats(): { keys: number; entries: string[] } {
  return { keys: store.size, entries: [...store.keys()] };
}
