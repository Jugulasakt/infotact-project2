import { remixAd, deleteCampaign } from '../api/adsApi';
import toast from 'react-hot-toast';

function CampaignCard({ campaign, onRemix, onDelete }) {
  const campaignId = campaign._id || campaign.id;

  const formattedDate = new Date(campaign.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleRemix = async () => {
    const toastId = toast.loading('Remixing campaign...');
    try {
      const newCampaign = await remixAd(campaignId);
      toast.success('Remix generated', { id: toastId });
      onRemix(newCampaign);
    } catch (error) {
      const message = error?.response?.data?.message || 'Remix failed';
      toast.error(message, { id: toastId });
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this campaign?');
    if (!confirmed) return;

    try {
      await deleteCampaign(campaignId);
      toast.success('Campaign deleted');
      onDelete(campaignId);
    } catch (error) {
      const message = error?.response?.data?.message || 'Delete failed';
      toast.error(message);
    }
  };

  return (
    <article className="history-card">
      <img
        className="history-card-img"
        src={campaign.imageUrl}
        alt="Campaign creative"
        loading="lazy"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
      <div className="history-card-body">
        <div className="history-meta">
          <span className={`badge badge-${campaign.platform}`}>{campaign.platform}</span>
          <span className="history-date">{formattedDate}</span>
        </div>

        <p className="history-caption">{campaign.caption}</p>

        <div className="history-actions">
          <button type="button" className="btn btn-outline" onClick={handleRemix}>
            Remix
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default CampaignCard;
