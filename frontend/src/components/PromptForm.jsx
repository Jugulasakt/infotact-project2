import { useState } from 'react';

const TONE_OPTIONS = [
  { value: 'witty', label: 'witty' },
  { value: 'professional', label: 'professional' },
  { value: 'bold', label: 'bold' },
  { value: 'emotional', label: 'emotional' },
  { value: 'minimalist', label: 'minimalist' }
];

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'instagram' },
  { value: 'facebook', label: 'facebook' },
  { value: 'linkedin', label: 'linkedin' },
  { value: 'twitter', label: 'twitter' }
];

function PromptForm({ loading, onGenerate }) {
  const [basePrompt, setBasePrompt] = useState('');
  const [tone, setTone] = useState('witty');
  const [platform, setPlatform] = useState('instagram');

  const handleSubmit = (event) => {
    event.preventDefault();
    onGenerate({
      basePrompt: basePrompt.trim(),
      tone,
      platform
    });
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="card-title">Prompt Studio</h2>

      <div className="form-group">
        <label htmlFor="basePrompt">Product Prompt</label>
        <textarea
          id="basePrompt"
          rows="6"
          placeholder="Eco-friendly coffee mug, 30% off, sustainable materials, perfect for morning routines"
          value={basePrompt}
          onChange={(e) => setBasePrompt(e.target.value)}
          required
          minLength={5}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="tone">Tone</label>
          <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="platform">Platform</label>
          <select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" />
            Generating...
          </>
        ) : (
          'Generate Ad'
        )}
      </button>

      {loading && <p className="loading-text">AI is crafting your ad creative... (~30s)</p>}
    </form>
  );
}

export default PromptForm;
