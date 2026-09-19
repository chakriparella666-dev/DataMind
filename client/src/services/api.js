import axios from 'axios';

const API_BASE = '/api';

// Helper to get or generate persistent guest ID for guest user isolation
const getOrCreateGuestId = () => {
  let guestId = localStorage.getItem('datamind_guest_id');
  if (!guestId) {
    guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('datamind_guest_id', guestId);
  }
  return guestId;
};

// Attach JWT Authorization or Guest ID Header dynamically
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('datamind_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    config.headers['x-guest-id'] = getOrCreateGuestId();
  }
  return config;
}, (error) => Promise.reject(error));

// Auth API Calls
export const registerUser = async (data) => {
  const res = await axios.post(`${API_BASE}/auth/register`, data);
  return res.data;
};

export const loginUser = async (data) => {
  const res = await axios.post(`${API_BASE}/auth/login`, data);
  return res.data;
};

export const googleAuth = async (data) => {
  const res = await axios.post(`${API_BASE}/auth/google`, data);
  return res.data;
};

export const getMe = async () => {
  const res = await axios.get(`${API_BASE}/auth/me`);
  return res.data;
};

// Data Source & Agent API Calls
export const connectPostgres = async (data) => {
  const res = await axios.post(`${API_BASE}/datasources/connect-postgres`, data);
  return res.data;
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axios.post(`${API_BASE}/datasources/upload-file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const createSampleData = async () => {
  const res = await axios.post(`${API_BASE}/datasources/sample-data`);
  return res.data;
};

export const getDataSources = async () => {
  const res = await axios.get(`${API_BASE}/datasources`);
  return res.data;
};

export const deleteDataSource = async (id) => {
  const res = await axios.delete(`${API_BASE}/datasources/${id}`);
  return res.data;
};

export const sendChatMessage = async (payload) => {
  const res = await axios.post(`${API_BASE}/agent/chat`, payload);
  return res.data;
};

export const getChatSessions = async (mode = null) => {
  const res = await axios.get(`${API_BASE}/agent/sessions`, { params: mode ? { mode } : {} });
  return res.data;
};

export const deleteChatSession = async (id) => {
  const res = await axios.delete(`${API_BASE}/agent/sessions/${id}`);
  return res.data;
};

export const saveQAPair = async (payload) => {
  const res = await axios.post(`${API_BASE}/training/save-qa`, payload);
  return res.data;
};

export const addGlossaryTerm = async (payload) => {
  const res = await axios.post(`${API_BASE}/training/glossary`, payload);
  return res.data;
};

export const getTrainingChunks = async (dataSourceId) => {
  const res = await axios.get(`${API_BASE}/training`, { params: { dataSourceId } });
  return res.data;
};

export const deleteTrainingChunk = async (id) => {
  const res = await axios.delete(`${API_BASE}/training/${id}`);
  return res.data;
};

// Dashboard & Stats API Calls
export const getDashboards = async () => {
  const res = await axios.get(`${API_BASE}/dashboards`);
  return res.data;
};

export const createDashboard = async (data) => {
  const res = await axios.post(`${API_BASE}/dashboards`, data);
  return res.data;
};

export const updateDashboard = async (id, data) => {
  const res = await axios.put(`${API_BASE}/dashboards/${id}`, data);
  return res.data;
};

export const deleteDashboard = async (id) => {
  const res = await axios.delete(`${API_BASE}/dashboards/${id}`);
  return res.data;
};

export const getSystemStats = async () => {
  const res = await axios.get(`${API_BASE}/stats/overview`);
  return res.data;
};

// Power BI Dashboard & Reports API Calls
export const getPowerBIReports = async () => {
  const res = await axios.get(`${API_BASE}/powerbi`);
  return res.data;
};

export const getPowerBIReportById = async (id) => {
  const res = await axios.get(`${API_BASE}/powerbi/${id}`);
  return res.data;
};

export const createPowerBIReport = async (data) => {
  const res = await axios.post(`${API_BASE}/powerbi`, data);
  return res.data;
};

export const updatePowerBIReport = async (id, data) => {
  const res = await axios.put(`${API_BASE}/powerbi/${id}`, data);
  return res.data;
};

export const deletePowerBIReport = async (id) => {
  const res = await axios.delete(`${API_BASE}/powerbi/${id}`);
  return res.data;
};

export const getPowerBIEmbedToken = async (data) => {
  const res = await axios.post(`${API_BASE}/powerbi/embed-token`, data);
  return res.data;
};

// Power BI Live Database & Automation API Calls
export const getPowerBISchema = async () => {
  const res = await axios.get(`${API_BASE}/powerbi/schema`);
  return res.data;
};

export const getPowerBITableAnalytics = async (tableName, limit = 100) => {
  const res = await axios.get(`${API_BASE}/powerbi/table-analytics/${encodeURIComponent(tableName)}`, {
    params: { limit }
  });
  return res.data;
};

export const getPowerQueryMCode = async (tableName) => {
  const res = await axios.get(`${API_BASE}/powerbi/powerquery-code/${encodeURIComponent(tableName)}`);
  return res.data;
};

