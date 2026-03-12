import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

function AdPreview({ loading, campaign, generationCount = 0 }) {
  const [loaded, setLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const campaignId = campaign?._id || campaign?.id;
  const imageUrl = campaign?.imageUrl || campaign?.rawImageUrl || '';
  const persistenceWarning =
    campaign?.warning?.message || 'Generated successfully, but not saved to database.';
  const displayImageUrl = useMemo(() => {
    if (!imageUrl) return '';

    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}v=${generationCount}`;
  }, [imageUrl, generationCount]);
  const persisted = campaign?.persisted !== false;
  const normalizedHashtags = useMemo(
    () =>
      (campaign?.hashtags || [])
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
        .map((tag) => (tag.startsWith('#') ? tag.slice(1) : tag)),
    [campaign?.hashtags]
  );

  useEffect(() => {
    setLoaded(false);
    setImageError(false);
  }, [displayImageUrl]);

  const handleCopyCaption = async () => {
    if (!campaign) return;
    const hashtagLine = normalizedHashtags.map((tag) => `#${tag}`).join(' ');
    const content = `${campaign.caption}\n\n${hashtagLine}`.trim();

    try {
      await navigator.clipboard.writeText(content);
      toast.success('Caption copied');
    } catch (error) {
      toast.error('Unable to copy caption');
    }
  };

  const handleDownload = async () => {
    if (!displayImageUrl) return;

    try {
      const response = await fetch(displayImageUrl, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `advantage-gen-${campaignId || Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      toast.error('Unable to download image');
    }
  };

  const platform = campaign?.platform || 'instagram';

  return (
    <section className="preview-card">
      <div className="preview-head">
        <h2 className="card-title">Ad Preview</h2>
        <span className={`badge badge-${platform}`}>{platform}</span>
      </div>

      <div className="preview-image-wrap">
        {loading && (
          <div className="preview-placeholder">
            <span className="spinner" />
            <p>Generating your creative...</p>
          </div>
        )}

        {!loading && !campaign && (
          <div className="preview-placeholder">
            <svg width="66" height="66" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="9" cy="9" r="1.5" fill="currentColor" />
              <path d="m21 16-5.2-5.2a1 1 0 0 0-1.4 0L8 17.2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <p>Your generated ad will appear here.</p>
          </div>
        )}

        {!loading && campaign && (!imageUrl || imageError) && (
          <div className="preview-placeholder">
            <p>Unable to load ad image. Please generate again.</p>
          </div>
        )}

        {!loading && campaign && imageUrl && !imageError && (
          <img
            src={displayImageUrl}
            alt="Generated ad"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {!loading && campaign && (
        <>
          {!persisted && <p className="preview-warning">{persistenceWarning}</p>}
          <p className="preview-caption">{campaign.caption}</p>
          <div className="hashtags-wrap">
            {normalizedHashtags.map((tag) => (
              <span className="hashtag" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
          <div className="preview-actions">
            <button type="button" className="btn btn-outline" onClick={handleCopyCaption}>
              Copy Caption
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDownload}>
              Download
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default AdPreview;
