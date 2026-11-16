// Modul rules: aturan bisnis yang menjadi sumber kebenaran tunggal
// Status bahan dihitung dengan urutan prioritas persis seperti NC.bahanStatus di frontend

export type BahanStatus = 'Kedaluwarsa' | 'Habis' | 'Periksa' | 'Menipis' | 'Aman';

export function bahanStatus(bahan: {
  // null = bahan tidak memiliki tanggal kedaluwarsa (tidak pernah dianggap kedaluwarsa)
  kedaluwarsa: string | Date | null;
  stok: number;
  minimum: number;
}): BahanStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const kedaluwarsa = bahan.kedaluwarsa ? new Date(bahan.kedaluwarsa) : null;
  if (kedaluwarsa) kedaluwarsa.setHours(0, 0, 0, 0);
  
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  // Urutan prioritas (persis seperti frontend):
  // 1. Kedaluwarsa (< hari ini)
  if (kedaluwarsa && kedaluwarsa < today) return 'Kedaluwarsa';
  
  // 2. Habis (stok <= 0)
  if (bahan.stok <= 0) return 'Habis';
  
  // 3. Periksa (kedaluwarsa <= hari ini + 7)
  if (kedaluwarsa && kedaluwarsa <= sevenDaysFromNow) return 'Periksa';
  
  // 4. Menipis (stok <= minimum)
  if (bahan.stok <= bahan.minimum) return 'Menipis';
  
  // 5. Aman
  return 'Aman';
}
