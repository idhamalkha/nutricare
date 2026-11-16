import { serializeId, serializeNumber, serializeDate } from './base.js';

export function serializePasien(row: any) {
  return {
    id: serializeId(row.id),
    nama: row.nama,
    rm: row.rm,
    ruangan: row.ruangan,
    diagnosis: row.diagnosis,
    usia: serializeNumber(row.usia),
    bb: serializeNumber(row.bb),
    tb: serializeNumber(row.tb),
    kalori: serializeNumber(row.kalori),
    tekstur: row.tekstur,
    status: row.status,
  };
}

export function serializePantangan(row: any) {
  return {
    id: serializeId(row.id),
    pasien: row.pasien_nama, // dari join
    alergi: row.alergi,
    pantangan: row.pantangan,
    catatan: row.catatan,
  };
}

export function serializeRekomendasi(row: any) {
  return {
    id: serializeId(row.id),
    tanggal: serializeDate(row.tanggal),
    pasien: row.pasien_nama,
    ruangan: row.ruangan,
    waktu: row.waktu,
    tekstur: row.tekstur,
    kalori: serializeNumber(row.kalori),
    diet: row.diet,
    menu: row.menu,
    komposisi: row.komposisi,
    catatan: row.catatan,
    status: row.status,
  };
}

export function serializeJadwal(row: any) {
  return {
    id: serializeId(row.id),
    pasien: row.pasien_nama,
    waktu: row.waktu,
    menu: row.menu,
    jam: row.jam.substring(0, 5), // HH:MM
    status: row.status,
  };
}

export function serializeLaporan(row: any) {
  return {
    id: serializeId(row.id),
    pasien: row.pasien_nama,
    info: row.info,
    tanggal: serializeDate(row.tanggal),
    waktu: row.waktu.substring(0, 5), // HH:MM
    status: row.status,
  };
}

export function serializeBahan(row: any) {
  return {
    id: serializeId(row.id),
    nama: row.nama,
    kategori: row.kategori,
    stok: serializeNumber(row.stok),
    satuan: row.satuan,
    minimum: serializeNumber(row.minimum),
    kedaluwarsa: serializeDate(row.kedaluwarsa),
  };
}
