// RBAC: Role-Based Access Control
// Matriks izin sesuai 01-analisis-frontend.md bagian 6
// C = Create, R = Read, U = Update, D = Delete, A = Action khusus

type Role = 'ahli-gizi' | 'waiter' | 'logistik' | 'dapur';
type Resource = 'pasien' | 'pantangan' | 'rekomendasi' | 'jadwal' | 'perawat' | 'bahan' | 'logistik';
type Permission = 'create' | 'read' | 'update' | 'delete' | 'action';

import { ForbiddenError } from './http/errors.js';

// Matriks izin (tabel konfigurasi)
// Catatan: Role Perawat dan Dokter kini berada di aplikasi Nadi
const permissions: Record<Role, Record<Resource, Permission[]>> = {
  'ahli-gizi': {
    pasien: ['create', 'read', 'update', 'delete'],
    pantangan: ['create', 'read', 'update', 'delete'],
    rekomendasi: ['create', 'read', 'update', 'delete', 'action'], // action = Kirim ke dapur
    jadwal: ['create', 'read', 'update', 'delete', 'action'], // action = Tandai terkirim
    perawat: ['create', 'read', 'update', 'delete', 'action'], // action = Tandai ditinjau
    bahan: ['create', 'read', 'update', 'delete'],
    logistik: ['read'], // Baca laporan/ringkasan saja
  },
  waiter: {
    pasien: [],
    pantangan: [],
    rekomendasi: [],
    jadwal: ['read', 'action'], // action = Konfirmasi terkirim

    perawat: [],
    bahan: [],
    logistik: [],
  },
  logistik: {
    pasien: [],
    pantangan: [],
    rekomendasi: ['read'],
    jadwal: [],
    perawat: [],
    bahan: ['create', 'read', 'update', 'delete'],
    logistik: ['create', 'read', 'update', 'delete'], // Modul logistik penuh
  },
  dapur: {
    // Tim dapur mengelola resep hidangan, menu paket diet, persiapan masak,
    // serta membaca data pasien dan bahan makanan.
    pasien: ['read'],
    pantangan: ['read'],
    rekomendasi: ['read'],
    jadwal: ['read'],
    perawat: [],
    bahan: ['read'],
    logistik: ['create', 'read', 'update', 'delete'], // Kelola resep, menu paket, dan persiapan
  },
};

export function checkPermission(
  role: Role,
  resource: Resource,
  permission: Permission
): boolean {
  const rolePerms = permissions[role];
  if (!rolePerms) return false;
  
  const resourcePerms = rolePerms[resource];
  if (!resourcePerms) return false;
  
  return resourcePerms.includes(permission);
}

export function requirePermission(
  role: Role,
  resource: Resource,
  permission: Permission
) {
  if (!checkPermission(role, resource, permission)) {
    throw new ForbiddenError('Anda tidak memiliki izin untuk aksi ini.');
  }
}
