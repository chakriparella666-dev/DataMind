/**
 * Power BI Integration Service
 * Provides token generation for Azure AD / Power BI REST APIs,
 * embed URL sanitization, and Power BI DAX query assistance.
 */

/**
 * Sanitize or format a Power BI embed or publish URL
 * Supports publish-to-web (view?r=...), secure embed (reportEmbed?reportId=...), or raw iframe src
 */
function sanitizeEmbedUrl(url) {
  if (!url) return '';
  let clean = url.trim();

  // Extract src if user pasted a full <iframe> snippet
  const iframeSrcMatch = clean.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    clean = iframeSrcMatch[1];
  }

  // Ensure https
  if (clean.startsWith('http://')) {
    clean = 'https://' + clean.slice(7);
  }

  return clean;
}

/**
 * Generate Azure AD Access Token & Power BI Embed Token
 * Used for App-Owns-Data / Service Principal embedding
 */
async function generatePowerBIEmbedToken({ tenantId, clientId, clientSecret, workspaceId, reportId }) {
  if (!tenantId || !clientId || !clientSecret || !workspaceId || !reportId) {
    throw new Error('Missing required Azure / Power BI credentials (tenantId, clientId, clientSecret, workspaceId, reportId)');
  }

  // 1. Acquire Azure AD OAuth token for Power BI resource
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const bodyParams = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://analysis.windows.net/powerbi/api/.default'
  });

  const aadResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString()
  });

  if (!aadResponse.ok) {
    const errText = await aadResponse.text();
    throw new Error(`Azure AD Authentication Failed (${aadResponse.status}): ${errText}`);
  }

  const aadData = await aadResponse.json();
  const aadAccessToken = aadData.access_token;

  // 2. Fetch Report Metadata to get datasetId and embedUrl
  const reportUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;
  const reportResponse = await fetch(reportUrl, {
    headers: {
      Authorization: `Bearer ${aadAccessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!reportResponse.ok) {
    const errText = await reportResponse.text();
    throw new Error(`Failed to fetch Power BI Report (${reportResponse.status}): ${errText}`);
  }

  const reportData = await reportResponse.json();
  const datasetId = reportData.datasetId;
  const embedUrl = reportData.embedUrl;

  // 3. Generate Power BI Embed Token (V2 GenerateToken API)
  const generateTokenUrl = 'https://api.powerbi.com/v1.0/myorg/GenerateToken';
  const tokenPayload = {
    reports: [{ id: reportId }],
    datasets: datasetId ? [{ id: datasetId }] : [],
    targetWorkspaces: [{ id: workspaceId }]
  };

  const embedTokenResponse = await fetch(generateTokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aadAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tokenPayload)
  });

  if (!embedTokenResponse.ok) {
    const errText = await embedTokenResponse.text();
    throw new Error(`Failed to generate Embed Token (${embedTokenResponse.status}): ${errText}`);
  }

  const embedTokenData = await embedTokenResponse.json();

  return {
    accessToken: embedTokenData.token,
    tokenId: embedTokenData.tokenId,
    expiration: embedTokenData.expiration,
    embedUrl: embedUrl,
    reportId: reportId,
    datasetId: datasetId
  };
}

module.exports = {
  sanitizeEmbedUrl,
  generatePowerBIEmbedToken
};
