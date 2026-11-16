#!/bin/bash
# Script untuk memverifikasi bahwa frontend tidak berubah

cd "$(dirname "$0")/.."
echo "🔍 Memeriksa integritas frontend..."

if sha256sum -c docs/frontend-checksums.txt; then
  echo "✅ Frontend aman, tidak ada perubahan"
  exit 0
else
  echo "❌ PERINGATAN: File frontend berubah! Batalkan perubahan atau tanyakan pemilik proyek."
  exit 1
fi
