// Serializer: ubah baris database ke format JSON frontend
// - id harus string (UUID)
// - numeric → number
// - time → HH:MM
// - date → YYYY-MM-DD

export function serializeId(id: any): string {
  return String(id);
}

export function serializeNumber(value: any): number {
  return typeof value === 'string' ? parseFloat(value) : Number(value);
}

export function serializeTime(time: any): string {
  if (!time) return '';
  // PostgreSQL time format: HH:MM:SS atau HH:MM:SS.ms
  // Frontend butuh: HH:MM
  const str = String(time);
  return str.substring(0, 5); // ambil HH:MM
}

export function serializeDate(date: any): string {
  if (!date) return '';
  if (date instanceof Date) {
    // PostgreSQL DATE (node-postgres) menjadi Date pada tengah malam waktu lokal.
    // toISOString() mengubahnya ke UTC dan dapat menggeser tanggal ke hari sebelumnya.
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(date);
  return str.split('T')[0]; // YYYY-MM-DD
}

// Base serializer untuk semua resource
export function serializeBase(row: any) {
  return {
    id: serializeId(row.id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
