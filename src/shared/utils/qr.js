const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const qrPayload = (referenceCode) =>
  `${process.env.APP_URL}/track/${referenceCode}`;

const qrOptions = {
  width: 300,
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' },
};

const getBookingQrBuffer = (referenceCode) =>
  QRCode.toBuffer(qrPayload(referenceCode), qrOptions);

const saveBookingQr = async (referenceCode) => {
  const dataUrl = await QRCode.toDataURL(qrPayload(referenceCode), qrOptions);

  if (process.env.NODE_ENV === 'production') {
    const cloudinary = require('../../config/cloudinary');
    const uploaded = await cloudinary.uploader.upload(dataUrl, {
      folder: 'herco-qr',
      public_id: referenceCode,
      overwrite: true,
    });
    return uploaded.secure_url;
  }

  const qrDir = path.join(__dirname, '../../../public/uploads/qr');
  if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
  const filename = `${referenceCode}.png`;
  fs.writeFileSync(
    path.join(qrDir, filename),
    Buffer.from(dataUrl.replace('data:image/png;base64,', ''), 'base64'),
  );
  return `${process.env.APP_URL}/uploads/qr/${filename}`;
};

module.exports = { saveBookingQr, getBookingQrBuffer };
