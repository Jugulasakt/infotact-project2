import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getHistory } from '../api/adsApi';
import CampaignCard from '../components/CampaignCard';

function HistoryPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getHistory();
        setCampaigns(data);
      } catch (error) {
        const message = error?.response?.data?.message || 'Failed to fetch history';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleRemix = (newCampaign) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
  };

  const handleDelete = (id) => {
    setCampaigns((prev) => prev.filter((campaign) => (campaign._id || campaign.id) !== id));
  };

  return (
    <main className="page">
      <section className="history-head">
        <div>
          <h1 className="history-title">Campaign History</h1>
          <p className="history-sub">{campaigns.length} campaigns saved</p>
        </div>
        <button className="nav-btn nav-btn-primary" type="button" onClick={() => navigate('/')}>
          + New Ad
        </button>
      </section>

      {loading && (
        <div className="empty-state">
          <span className="spinner" />
          <p>Loading campaigns...</p>
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <h3>No campaigns yet</h3>
          <p>Your generated ads will appear here once you create one.</p>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/')}>
            Create First Ad
          </button>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <section className="history-grid">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign._id || campaign.id}
              campaign={campaign}
              onRemix={handleRemix}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}
    </main>
  );
}

export default HistoryPage;

