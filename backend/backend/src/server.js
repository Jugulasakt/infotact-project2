const dotenv = require('dotenv');

dotenv.config();

const app = require('./app');

const PORT = process.env.PORT || 5000;

function envStatus(key) {
  return process.env[key] ? 'set' : 'missing';
}

console.log('[startup] Environment checks');
console.log(`[startup] DATABASE_URL: ${envStatus('DATABASE_URL')}`);
console.log(`[startup] GEMINI_API_KEY: ${envStatus('GEMINI_API_KEY')}`);
console.log(`[startup] HUGGINGFACE_API_KEY: ${envStatus('HUGGINGFACE_API_KEY')}`);
console.log(`[startup] CLOUDINARY_CLOUD_NAME: ${envStatus('CLOUDINARY_CLOUD_NAME')}`);
console.log(`[startup] CLOUDINARY_API_KEY: ${envStatus('CLOUDINARY_API_KEY')}`);
console.log(`[startup] CLOUDINARY_API_SECRET: ${envStatus('CLOUDINARY_API_SECRET')}`);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
