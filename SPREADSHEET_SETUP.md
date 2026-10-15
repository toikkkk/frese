# Menghubungkan pencatatan pesanan ke Google Sheets

Website mencatat pesanan ke Google Sheets **setelah pelanggan menekan "Saya sudah bayar"** pada langkah pembayaran QRIS. Satu baris berisi: waktu, ID pesanan, nama pemesan, produk, jumlah item, total, metode pembayaran, status pembayaran (`Sudah dibayar (konfirmasi pelanggan)`), dan tautan **bukti pembayaran** (foto disimpan di folder Google Drive `FRESÈ Bukti Bayar`; opsional isi Script Property `PROOF_FOLDER_ID` untuk memakai folder sendiri). Jika spreadsheet belum terhubung, pelanggan tetap diarahkan ke WhatsApp dengan detail pesanan lengkap.

> Jika tab `Pesanan` sudah berisi header lama, hapus tab itu atau kosongkan isinya agar header baru (9 kolom) dibuat otomatis.

> Status "sudah dibayar" berasal dari konfirmasi pelanggan, bukan verifikasi otomatis dari bank. Cocokkan dengan mutasi QRIS sebelum pesanan dikirim. Verifikasi otomatis butuh payment gateway (mis. Midtrans/Xendit).

## Yang disiapkan

1. Buat atau pilih spreadsheet di akun Google yang akan menerima pesanan.
2. Di menu **Extensions → Apps Script**, salin isi `google-apps-script/Code.gs` ke editor proyek Apps Script.
3. Di **Project Settings → Script Properties**, tambahkan `SPREADSHEET_ID` (ID pada URL spreadsheet) dan `ORDER_TOKEN` (token acak panjang yang Anda buat sendiri).
4. Deploy Apps Script sebagai **Web app**, jalankan sebagai pemilik sheet, dan izinkan akses sesuai kebijakan akun Anda. Salin URL deployment `/exec`.
5. Konfigurasikan dua variabel runtime server website: `GOOGLE_SHEETS_WEB_APP_URL` berisi URL deployment dan `GOOGLE_SHEETS_ORDER_TOKEN` berisi token yang sama. Simpan token hanya sebagai konfigurasi terlindungi—jangan di frontend atau repository.
6. Uji satu pesanan kecil, lalu pastikan satu baris baru muncul pada tab `Pesanan`. Website hanya menampilkan status tercatat jika Apps Script membalas `recorded: true`.

Tanpa langkah konfigurasi tersebut, pesanan **tidak** disimpan pada spreadsheet; pelanggan tetap bisa meneruskan detail pesan melalui WhatsApp.

> Setelah memperbarui `Code.gs`, deploy ulang Web app (**Deploy → Manage deployments → Edit → New version**) dan setujui izin Google Drive yang diminta.
