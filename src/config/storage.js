// Pasta onde as imagens dos produtos são salvas no servidor.
const path = require('path');

module.exports = {
  uploadsDir: process.env.UPLOADS_DIR || path.resolve(__dirname, '..', '..', 'uploads'),
};
