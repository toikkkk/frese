function doPost(e) {
  try {
    const order = JSON.parse(e.postData.contents || '{}');
    const properties = PropertiesService.getScriptProperties();
    const expectedToken = properties.getProperty('ORDER_TOKEN');
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');

    if (!expectedToken || !spreadsheetId || !order.token || order.token !== expectedToken) {
      return json_({ recorded: false, error: 'unauthorized_or_unconfigured' });
    }
    if (!order.orderId || !order.customer || !Array.isArray(order.items) || !Number.isFinite(order.total) || !order.payment) {
      return json_({ recorded: false, error: 'invalid_order' });
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName('Pesanan') || spreadsheet.insertSheet('Pesanan');
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (sheet.getLastRow() === 0) {
        const proofUrl = saveProof_(order, properties);
      sheet.appendRow(['Waktu', 'ID Pesanan', 'Nama Pemesan', 'Produk', 'Jumlah Item', 'Total (IDR)', 'Metode Pembayaran', 'Status Pembayaran', 'Bukti Pembayaran']);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
      }
      const products = order.items.map(function(item) {
        return item.name + ' x ' + item.quantity + ' (Rp' + Number(item.subtotal).toLocaleString('id-ID') + ')';
      }).join(' | ');
      const itemCount = order.items.reduce(function(sum, item) { return sum + Number(item.quantity || 0); }, 0);
      const proofUrl = saveProof_(order, properties);
      sheet.appendRow([
        order.createdAt || new Date().toISOString(), order.orderId,
        safeCell_(order.customer.name), products, itemCount, Number(order.total),
        safeCell_(order.payment.method), safeCell_(order.payment.status), proofUrl,
      ]);
    } finally {
      lock.releaseLock();
    }
    return json_({ recorded: true, orderId: order.orderId });
  } catch (error) {
    return json_({ recorded: false, error: 'write_failed' });
  }
}

function saveProof_(order, properties) {
  if (!order.proof || !order.proof.data) return '';
  try {
    let folder;
    const folderId = properties.getProperty('PROOF_FOLDER_ID');
    if (folderId) folder = DriveApp.getFolderById(folderId);
    else {
      const found = DriveApp.getFoldersByName('FRESE Bukti Bayar');
      folder = found.hasNext() ? found.next() : DriveApp.createFolder('FRESE Bukti Bayar');
    }
    const blob = Utilities.newBlob(Utilities.base64Decode(order.proof.data), 'image/jpeg', order.orderId + '.jpg');
    return folder.createFile(blob).getUrl();
  } catch (error) {
    return 'gagal menyimpan bukti';
  }
}

function safeCell_(value) {
  const text = String(value || '').slice(0, 300);
  return /^[=+@\-]/.test(text) ? "'" + text : text;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
