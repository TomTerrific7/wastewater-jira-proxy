const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
  'http://localhost:3000', 
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
  /^https:\/\/.*\.figma\.com$/,   // Allow Figma Make
  /^https:\/\/.*\.figma\.dev$/,   // Allow Figma Dev
  /^https:\/\/.*\.figma\.site$/,  // Allow Figma Preview  ← NEW!
],
  credentials: true
}));

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Jira proxy server is running' });
});

app.post('/api/jira/validate', async (req, res) => {
  const { domain, email, apiToken, projectKey } = req.body.config;

  try {
    const myselfResponse = await axios.get(
      `https://${domain}/rest/api/3/myself`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    const projectResponse = await axios.get(
      `https://${domain}/rest/api/3/project/${projectKey}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    const createMetaResponse = await axios.get(
      `https://${domain}/rest/api/3/issue/createmeta?projectKeys=${projectKey}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!createMetaResponse.data.projects || createMetaResponse.data.projects.length === 0) {
      return res.status(403).json({ 
        valid: false, 
        error: 'No permission to create issues. Contact your Jira admin.' 
      });
    }

    res.json({ 
      valid: true, 
      user: myselfResponse.data,
      project: projectResponse.data 
    });

  } catch (error) {
    console.error('Jira validation error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid credentials. Check your email and API token.' 
      });
    } else if (error.response?.status === 404) {
      return res.status(404).json({ 
        valid: false, 
        error: 'Jira domain or project not found.' 
      });
    } else {
      return res.status(500).json({ 
        valid: false, 
        error: error.response?.data?.errorMessages?.[0] || error.message 
      });
    }
  }
});

app.post('/api/jira/users', async (req, res) => {
  const { domain, email, apiToken, projectKey } = req.body.config;

  try {
    const response = await axios.get(
      `https://${domain}/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=100`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Jira users:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.errorMessages?.[0] || error.message 
    });
  }
});

app.post('/api/jira/epic', async (req, res) => {
  const { domain, email, apiToken } = req.body.config;
  const { epicData } = req.body;

  try {
    const response = await axios.post(
      `https://${domain}/rest/api/3/issue`,
      epicData,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Jira Epic created:', response.data.key);
    res.json(response.data);
  } catch (error) {
    console.error('Error creating Jira Epic:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.errorMessages?.[0] || error.message,
      details: error.response?.data
    });
  }
});

app.post('/api/jira/issues', async (req, res) => {
  const { domain, email, apiToken, projectKey } = req.body.config;

  try {
    const response = await axios.get(
      `https://${domain}/rest/api/3/search?jql=project=${projectKey} AND issuetype=Epic&maxResults=100`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Jira issues:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.errorMessages?.[0] || error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Jira Proxy Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`\n🔐 Remember to set your Jira credentials in the frontend app!`);
});
