# TODO FRESE

## Katalog produk dan identitas brand
- [x] Halaman utama responsif berbahasa Indonesia menampilkan identitas FRESE dengan palet Forest Green `#2E7D6A`, Sage Green `#A7C4B0`, Mint Green `#DCEDE1`, Soft Cream `#FAF9F4`, dan Coffee Brown `#6B4F3A`.
- [x] Hero desktop meniru komposisi poster editorial referensi: latar krem lapang, ilustrasi utama di tengah, keterangan kecil di kiri, headline besar di bagian bawah, serta teks vertikal dan ajakan di kanan; konten tetap terbaca dan sesuai dengan identitas FRESE.
- [x] Pada layar ponsel, bagian home tersusun rapi tanpa tumpang-tindih: judul, foto, informasi, dan tombol ajakan tampil berurutan; kartu produk menampilkan foto dan deskripsi dengan ukuran teks yang mudah dibaca.
- [x] Katalog menampilkan dua varian dengan foto produk terlampir: Jasmine seharga Rp17.000 dan Kopi seharga Rp20.000.
- [x] Detail Jasmine menyampaikan aroma bunga melati yang lembut, floral, menenangkan, memberi kesan ruangan segar, nyaman, dan bersih, menciptakan suasana rileks serta menjaga sepatu tetap harum lebih lama.
- [x] Detail Kopi menyampaikan aroma khas, hangat, kaya karakter, memberi kesan nyaman dan segar, membantu menyamarkan bau tidak sedap pada sepatu, dan menghadirkan aroma unik berkarakter.

## Pemesanan WhatsApp
- [x] Pelanggan dapat memilih varian dan jumlah pembelian serta melihat subtotal dan total pesanan dihitung otomatis.
- [x] Formulir pemesanan mengumpulkan informasi pelanggan dan detail pengiriman yang diperlukan.
- [x] Tombol pesan mengarahkan pelanggan ke WhatsApp `082140105332` dengan pesan siap kirim yang mencantumkan data pelanggan, varian, jumlah, dan total pesanan.
- [x] Tata letak mobile-first dan navigasi ajakan membeli yang jelas memudahkan pemesanan dari ponsel.

## Pencatatan spreadsheet
- [ ] Setiap pesanan formulir dicatat ke spreadsheet secara otomatis sebelum pelanggan melanjutkan ke WhatsApp.
- [x] Jika akses spreadsheet belum tersedia, alur menyampaikan dengan jelas bahwa pesanan belum tercatat dan tetap membuka WhatsApp untuk melanjutkan pemesanan.
- Catatan: backend, Google Apps Script pendamping, dan panduan koneksi telah disiapkan. Konektor Google Workspace tidak diaktifkan; uji endpoint tanpa kredensial mengembalikan status belum tercatat dengan jelas. Lihat `SPREADSHEET_SETUP.md`.
