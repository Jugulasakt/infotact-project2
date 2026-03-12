const { createAd } = require('../services/adGenerationService');

function validateGenerateBody(body) {
  const errors = [];

  const basePrompt = typeof body.basePrompt === 'string' ? body.basePrompt.trim() : '';
  const tone = typeof body.tone === 'string' ? body.tone.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform.trim() : '';

  if (!basePrompt || basePrompt.length < 5) {
    errors.push('basePrompt must be at least 5 characters long.');
  }

  if (!tone) {
    errors.push('tone is required.');
  }

  if (!platform) {
    errors.push('platform is required.');
  }

  return {
    errors,
    values: {
      basePrompt,
      tone,
      platform,
    },
  };
}

async function generateAd(req, res) {
  try {
    const { errors, values } = validateGenerateBody(req.body || {});

    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    const ad = await createAd(values);

    return res.status(201).json(ad);
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;

    console.error('[ads.generate] Request failed', {
      message: error.message,
      statusCode: status,
      stack: error.stack,
      details: error.details || null,
    });

    return res.status(status).json({
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      details: error.details || undefined,
    });
  }
}

module.exports = {
  generateAd,
};
