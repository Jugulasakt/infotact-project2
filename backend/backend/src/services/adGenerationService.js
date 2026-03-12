const axios = require('axios');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');
const { stripMarkdownCodeFences } = require('../utils/json');

let isAdsTableReady = false;
let hfCreditCooldownUntil = 0;
let geminiQuotaCooldownUntil = 0;

const GEMINI_JSON_COMPATIBLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
];

async function ensureAdsTable() {
  if (isAdsTableReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      base_prompt TEXT NOT NULL,
      detailed_prompt TEXT NOT NULL,
      platform TEXT NOT NULL,
      tone TEXT NOT NULL,
      image_url TEXT NOT NULL,
      raw_image_url TEXT,
      caption TEXT NOT NULL,
      hashtags JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  isAdsTableReady = true;
}

function buildError(message, statusCode, code, details) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function parseGeminiJson(rawText) {
  const sanitized = stripMarkdownCodeFences(rawText);

  try {
    return JSON.parse(sanitized);
  } catch (error) {
    throw buildError(
      'Gemini returned invalid JSON output',
      500,
      'GEMINI_INVALID_JSON',
      { rawPreview: sanitized.slice(0, 500) }
    );
  }
}

function normalizeHashtags(hashtags) {
  if (Array.isArray(hashtags)) {
    return hashtags.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof hashtags === 'string') {
    return hashtags
      .split(/[,\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function extractGeminiErrorMeta(error) {
  const message = error?.message || 'Gemini request failed';
  const lower = message.toLowerCase();
  const status =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.cause?.status ||
    null;

  return { message, lower, status };
}

function extractRetryAfterSeconds(message) {
  const match = String(message || '').match(/retry in\s+([0-9.]+)s/i);
  if (!match) {
    return null;
  }
  const seconds = Math.ceil(Number(match[1]));
  return Number.isFinite(seconds) ? seconds : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDbSaveWarning(dbError) {
  const code = String(dbError?.code || 'DB_SAVE_FAILED');

  if (code === '28P01') {
    return {
      code,
      message: 'Ad generated, but saving failed due to invalid database credentials.',
    };
  }

  return {
    code,
    message: 'Ad generated, but saving to database failed.',
  };
}

async function generateFreeFallbackImage(prompt) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const encodedPrompt = encodeURIComponent(String(prompt || '').slice(0, 600));
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${encodeURIComponent(nonce)}`;

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 45000,
  });

  return Buffer.from(response.data);
}

async function generateStockFallbackImage(prompt) {
  const words = String(prompt || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 5);
  const terms = words.length > 0 ? words.join(',') : 'product,advertising';
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sources = [
    `https://loremflickr.com/1024/1024/${encodeURIComponent(terms)}?lock=${encodeURIComponent(seed)}`,
    `https://picsum.photos/seed/${encodeURIComponent(seed)}/1024/1024`,
  ];

  let lastError = null;

  for (const url of sources) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 45000,
        maxRedirects: 5,
      });
      return Buffer.from(response.data);
    } catch (error) {
      lastError = error;
      console.error('[ads.service] Stock source failed', {
        url,
        message: error?.message || 'Unknown stock source error',
        status: error?.response?.status || null,
      });
    }
  }

  throw lastError || new Error('All stock sources failed');
}

function buildGeminiPrompt({ basePrompt, tone, platform }) {
  return [
    'You are an ad creative generator.',
    'Return strict JSON only. No markdown fences.',
    'Required JSON schema:',
    '{"detailedPrompt":"string","caption":"string","hashtags":["#tag1"]}',
    `Base Prompt: ${basePrompt}`,
    `Tone: ${tone}`,
    `Platform: ${platform}`,
  ].join('\n');
}

function buildFallbackAdCopy({ basePrompt, tone, platform }) {
  const safeBase = String(basePrompt || '').trim();
  const safeTone = String(tone || 'confident').trim();
  const safePlatform = String(platform || 'social media').trim();

  return {
    detailedPrompt: `High-quality product advertisement image for ${safePlatform}. Visual style: ${safeTone}. Scene concept: ${safeBase}. Studio lighting, clean composition, sharp details, marketing-ready.`,
    caption: `${safeBase}. ${safeTone.charAt(0).toUpperCase()}${safeTone.slice(1)} energy for ${safePlatform}.`,
    hashtags: ['#ad', '#marketing', '#creative', '#brand'],
  };
}

async function listGeminiGenerateModels(apiKey) {
  try {
    const response = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
      params: { key: apiKey },
      timeout: 15000,
    });

    const models = Array.isArray(response.data?.models) ? response.data.models : [];

    return models
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('[ads.service] Failed to list Gemini models', {
      message: error?.message || 'Unknown list models error',
      status: error?.response?.status || null,
    });
    return [];
  }
}

function isGeminiModelJsonCompatible(modelName) {
  const normalized = String(modelName || '').trim();
  if (!normalized) {
    return false;
  }

  if (GEMINI_JSON_COMPATIBLE_MODELS.includes(normalized)) {
    return true;
  }

  const lower = normalized.toLowerCase();

  if (lower.includes('tts')) {
    return false;
  }

  if (lower.includes('gemma-')) {
    return false;
  }

  return false;
}

function shouldContinueGeminiFallback(meta) {
  if (!meta) {
    return false;
  }

  if (meta.status === 404) {
    return true;
  }

  if (
    meta.lower.includes('not found') ||
    meta.lower.includes('model') ||
    meta.lower.includes('unsupported')
  ) {
    return true;
  }

  return false;
}

function isGeminiQuotaError(meta) {
  if (!meta) {
    return false;
  }

  return (
    meta.status === 429 ||
    meta.lower.includes('quota') ||
    meta.lower.includes('rate limit') ||
    meta.lower.includes('too many requests')
  );
}

async function generateAdCopy({ basePrompt, tone, platform }) {
  if (!process.env.GEMINI_API_KEY) {
    throw buildError('Gemini API key is missing', 401, 'GEMINI_KEY_MISSING');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const prompt = buildGeminiPrompt({ basePrompt, tone, platform });
  const preferredCandidates = [
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ].filter(isGeminiModelJsonCompatible);
  const discoveredCandidates = await listGeminiGenerateModels(process.env.GEMINI_API_KEY);
  const modelCandidates = [...new Set([...preferredCandidates, ...discoveredCandidates])]
    .filter(isGeminiModelJsonCompatible);

  const now = Date.now();
  if (geminiQuotaCooldownUntil > now) {
    const remainingSeconds = Math.max(1, Math.ceil((geminiQuotaCooldownUntil - now) / 1000));
    console.warn('[ads.service] Gemini quota cooldown active, using fallback copy', {
      remainingSeconds,
    });
    return buildFallbackAdCopy({ basePrompt, tone, platform });
  }

  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const text = response?.response?.text ? response.response.text() : '';
      const parsed = parseGeminiJson(text);

      if (!parsed.detailedPrompt || !parsed.caption) {
        throw buildError('Gemini JSON missing required fields', 500, 'GEMINI_SCHEMA_INVALID', parsed);
      }

      return {
        detailedPrompt: String(parsed.detailedPrompt).trim(),
        caption: String(parsed.caption).trim(),
        hashtags: normalizeHashtags(parsed.hashtags),
      };
    } catch (error) {
      lastError = error;
      const meta = extractGeminiErrorMeta(error);

      console.error('[ads.service] Gemini generation failed', {
        modelName,
        message: meta.message,
        status: meta.status,
        stack: error.stack,
      });

      if (isGeminiQuotaError(meta)) {
        const retrySeconds = extractRetryAfterSeconds(meta.message) || 30;
        geminiQuotaCooldownUntil = Date.now() + retrySeconds * 1000;
        console.warn('[ads.service] Gemini quota exceeded, using fallback copy', {
          modelName,
          retrySeconds,
        });
        return buildFallbackAdCopy({ basePrompt, tone, platform });
      }

      if (!shouldContinueGeminiFallback(meta)) {
        break;
      }
    }
  }

  const meta = extractGeminiErrorMeta(lastError || {});

  if (meta.status === 403 || meta.lower.includes('forbidden') || meta.lower.includes('permission')) {
    throw buildError('Gemini authorization failed', 403, 'GEMINI_AUTH_FAILED', { providerMessage: meta.message });
  }

  if (meta.status === 401 || meta.lower.includes('api key') || meta.lower.includes('unauthorized') || meta.lower.includes('auth')) {
    throw buildError('Gemini authentication failed', 401, 'GEMINI_AUTH_FAILED', { providerMessage: meta.message });
  }

  if (isGeminiQuotaError(meta)) {
    const retrySeconds = extractRetryAfterSeconds(meta.message) || 30;
    geminiQuotaCooldownUntil = Date.now() + retrySeconds * 1000;
    console.warn('[ads.service] Gemini quota exceeded, using fallback copy');
    return buildFallbackAdCopy({ basePrompt, tone, platform });
  }

  if (!lastError) {
    console.warn('[ads.service] Gemini unavailable without explicit error, using fallback copy');
    return buildFallbackAdCopy({ basePrompt, tone, platform });
  }

  if (lastError?.statusCode) {
    throw lastError;
  }

  throw buildError('Failed to generate ad copy from Gemini', 500, 'GEMINI_REQUEST_FAILED', {
    providerMessage: meta.message || null,
    providerStatus: meta.status || null,
    modelCandidatesTried: modelCandidates,
  });
}

async function generateImageBuffer(prompt) {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  const cooldownMinutes = Math.max(1, Number(process.env.HF_CREDIT_COOLDOWN_MINUTES || 30));
  const now = Date.now();

  if (hfCreditCooldownUntil > now) {
    const remainingMs = hfCreditCooldownUntil - now;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    console.warn('[ads.service] Skipping Hugging Face image generation during credit cooldown', {
      remainingMinutes,
    });
  }

  if (!hfToken) {
    console.warn('[ads.service] Hugging Face API key missing, using fallback image providers');
  }

  const imageEndpoint =
    process.env.HUGGINGFACE_IMAGE_ENDPOINT ||
    process.env.HUGGINGFACE_MODEL_URL ||
    'https://router.huggingface.co/together/v1/images/generations';
  const modelCandidates = [
    process.env.HUGGINGFACE_IMAGE_MODEL,
    'Qwen/Qwen-Image',
    'stabilityai/stable-diffusion-3-medium',
  ].filter(Boolean);

  let lastError = null;
  const maxAttemptsPerUrl = 2;

  if (hfToken && now >= hfCreditCooldownUntil) {
    for (const modelName of [...new Set(modelCandidates)]) {
      for (let attempt = 1; attempt <= maxAttemptsPerUrl; attempt += 1) {
        try {
          const response = await axios.post(
            imageEndpoint,
            {
              model: modelName,
              prompt,
              n: 1,
              response_format: 'b64_json',
              size: process.env.HUGGINGFACE_IMAGE_SIZE || '1024x1024',
            },
            {
              headers: {
                Authorization: `Bearer ${hfToken}`,
                'Content-Type': 'application/json',
              },
              responseType: 'json',
              timeout: 120000,
            }
          );

          const item = Array.isArray(response.data?.data) ? response.data.data[0] : null;
          const b64 = item?.b64_json;
          const imageUrl = item?.url;

          if (b64) {
            return Buffer.from(b64, 'base64');
          }

          if (imageUrl) {
            const imgRes = await axios.get(imageUrl, {
              responseType: 'arraybuffer',
              timeout: 120000,
            });
            return Buffer.from(imgRes.data);
          }

          throw buildError('Hugging Face returned no image payload', 502, 'HF_EMPTY_IMAGE_RESPONSE', {
            modelName,
            responsePreview: JSON.stringify(response.data).slice(0, 500),
          });
        } catch (error) {
          lastError = error;
          const status = error.response?.status;
          const body = error.response?.data
            ? (typeof error.response.data === 'string'
                ? error.response.data
                : JSON.stringify(error.response.data)).slice(0, 500)
            : null;
          const lowerBody = String(body || '').toLowerCase();

          console.error('[ads.service] HuggingFace image generation failed', {
            endpoint: imageEndpoint,
            modelName,
            attempt,
            message: error.message,
            status,
            responseData: body,
          });

          if (status === 401 || status === 403) {
            throw buildError('Hugging Face authentication failed', status, 'HF_AUTH_FAILED');
          }

          if (status === 402) {
            hfCreditCooldownUntil = Date.now() + cooldownMinutes * 60 * 1000;
            if (attempt === 1) {
              console.warn('[ads.service] Hugging Face provider credits unavailable, skipping retries for this model', {
                cooldownMinutes,
              });
            }
            break;
          }

          if (status === 410) {
            continue;
          }

          if (status === 503 || lowerBody.includes('loading')) {
            const waitMs = 2000 * attempt;
            await sleep(waitMs);
            continue;
          }

          if (status === 429) {
            const waitMs = 2000 * attempt;
            await sleep(waitMs);
            continue;
          }

          if (status === 404) {
            continue;
          }

          break;
        }
      }
    }
  }

  try {
    const freeImage = await generateFreeFallbackImage(prompt);
    console.warn('[ads.service] Using free fallback image provider because Hugging Face generation failed');
    return freeImage;
  } catch (freeError) {
    console.error('[ads.service] Free fallback image generation failed', {
      message: freeError?.message || 'Unknown fallback provider error',
      status: freeError?.response?.status || null,
    });
  }

  try {
    const stockImage = await generateStockFallbackImage(prompt);
    console.warn('[ads.service] Using stock fallback image provider because AI image providers failed');
    return stockImage;
  } catch (stockError) {
    console.error('[ads.service] Stock fallback image generation failed', {
      message: stockError?.message || 'Unknown stock provider error',
      status: stockError?.response?.status || null,
    });
  }

  const fallbackText = String(prompt || '').slice(0, 120).replace(/[<>&]/g, '');
  const svg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)" />
      <text x="64" y="220" fill="#f8fafc" font-size="46" font-family="Arial, sans-serif">Ad Preview</text>
      <text x="64" y="300" fill="#cbd5e1" font-size="28" font-family="Arial, sans-serif">${fallbackText}</text>
    </svg>
  `;
  const placeholderBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  console.warn('[ads.service] Using placeholder image because Hugging Face generation failed');
  return placeholderBuffer;
}

function uploadBufferToCloudinary(imageBuffer) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw buildError('Cloudinary credentials are missing', 401, 'CLOUDINARY_KEY_MISSING');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || 'ads',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          console.error('[ads.service] Cloudinary upload failed', {
            message: error.message,
            http_code: error.http_code,
            name: error.name,
          });

          if (error.http_code === 401 || error.http_code === 403) {
            reject(buildError('Cloudinary authentication failed', error.http_code, 'CLOUDINARY_AUTH_FAILED'));
            return;
          }

          reject(buildError('Cloudinary upload failed', 500, 'CLOUDINARY_UPLOAD_FAILED', error));
          return;
        }

        resolve(result);
      }
    );

    stream.end(imageBuffer);
  });
}

async function saveAdRecord(payload) {
  await ensureAdsTable();

  const query = `
    INSERT INTO ads (
      base_prompt,
      detailed_prompt,
      platform,
      tone,
      image_url,
      raw_image_url,
      caption,
      hashtags
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    RETURNING id, base_prompt, detailed_prompt, platform, tone, image_url, raw_image_url, caption, hashtags, created_at
  `;

  const values = [
    payload.basePrompt,
    payload.detailedPrompt,
    payload.platform,
    payload.tone,
    payload.imageUrl,
    payload.rawImageUrl,
    payload.caption,
    JSON.stringify(payload.hashtags),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function createAd({ basePrompt, tone, platform }) {
  console.log('[ads.service] createAd started', { basePromptLength: basePrompt.length, tone, platform });

  const copy = await generateAdCopy({ basePrompt, tone, platform });

  const rawBuffer = await generateImageBuffer(copy.detailedPrompt);

  const imageBuffer = await sharp(rawBuffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  const uploadResult = await uploadBufferToCloudinary(imageBuffer);

  try {
    const row = await saveAdRecord({
      basePrompt,
      detailedPrompt: copy.detailedPrompt,
      platform,
      tone,
      imageUrl: uploadResult.secure_url,
      rawImageUrl: uploadResult.url || uploadResult.secure_url,
      caption: copy.caption,
      hashtags: copy.hashtags,
    });

    return {
      id: row.id,
      basePrompt: row.base_prompt,
      detailedPrompt: row.detailed_prompt,
      platform: row.platform,
      tone: row.tone,
      imageUrl: row.image_url,
      rawImageUrl: row.raw_image_url,
      caption: row.caption,
      hashtags: row.hashtags,
      createdAt: row.created_at,
      persisted: true,
    };
  } catch (dbError) {
    if (process.env.ADS_REQUIRE_DB === 'true') {
      throw dbError;
    }
    const warning = buildDbSaveWarning(dbError);

    console.warn('[ads.service] DB save failed, returning non-persisted ad response', {
      message: dbError?.message || 'Unknown DB error',
      code: dbError?.code || null,
      warning,
    });

    return {
      id: null,
      basePrompt,
      detailedPrompt: copy.detailedPrompt,
      platform,
      tone,
      imageUrl: uploadResult.secure_url,
      rawImageUrl: uploadResult.url || uploadResult.secure_url,
      caption: copy.caption,
      hashtags: copy.hashtags,
      createdAt: new Date().toISOString(),
      persisted: false,
      warning,
    };
  }
}

module.exports = {
  createAd,
};
