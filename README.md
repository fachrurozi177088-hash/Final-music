# GAMEWAVE Music — Netlify + Supabase

Versi cloud GameWave Music untuk pemula. Netlify menjalankan website; Supabase menangani akun, database, dan penyimpanan musik.

## Fitur
- Login / Sign up
- Upload musik ke cloud
- Musik private hanya untuk pemilik
- Musik Public bisa dilihat dan diputar oleh akun lain di perangkat lain
- Favorites, recently played, playlist, search
- Player dengan queue, shuffle, repeat
- PWA

## A. Buat project Supabase
1. Buka https://supabase.com/ dan buat akun.
2. Buat project baru.
3. Buka **SQL Editor**.
4. Buat query baru.
5. Salin seluruh isi `supabase-schema.sql` ke query tersebut.
6. Klik **Run**.

## B. Ambil kunci Supabase
Di project Supabase buka **Project Settings → API**.
Salin:
- Project URL
- Publishable key

Jangan masukkan `service_role` key ke website.

## C. Deploy ke Netlify
1. Buat repository GitHub baru.
2. Upload semua isi folder project ini ke repository (bukan file ZIP di dalam repository).
3. Di Netlify pilih **Add new project → Import an existing project → GitHub**.
4. Pilih repository GameWave Music.
5. Build command: `npm run build`
6. Publish directory: `dist`
7. Sebelum deploy, buka **Project configuration → Environment variables** dan tambahkan:
   - `VITE_SUPABASE_URL` = Project URL kamu
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = Publishable key kamu
8. Klik Deploy.

## D. Setelah website online
1. Buka URL Netlify di HP 1.
2. Sign up / login.
3. Centang **Public saat upload** sebelum memilih lagu.
4. Upload lagu.
5. Buka URL Netlify yang sama di HP 2.
6. Login dengan akun lain.
7. Lagu Public dari HP 1 akan muncul dan dapat diputar.

Catatan: file musik disimpan di Supabase Storage. Website menggunakan signed URL sehingga bucket tetap private.
