import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

export const generateAd = async (data) => {
  const response = await api.post('/ads/generate', data);
  return response.data;
};

export const getHistory = async () => {
  const response = await api.get('/ads/history');
  return response.data;
};

export const getCampaign = async (id) => {
  const response = await api.get(`/ads/${id}`);
  return response.data;
};

export const remixAd = async (id) => {
  const response = await api.post(`/ads/remix/${id}`);
  return response.data;
};

export const deleteCampaign = async (id) => {
  const response = await api.delete(`/ads/${id}`);
  return response.data;
};
