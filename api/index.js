// Vercel Serverless Function for Notion API
const { Client } = require('@notionhq/client');

// Environment variables
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const KPIS_DB_ID = process.env.KPIS_DB_ID;
const PROJECTS_DB_ID = process.env.PROJECTS_DB_ID;

// Initialize Notion client
let notion;
if (NOTION_TOKEN) {
  notion = new Client({ auth: NOTION_TOKEN });
}

// Helper: Extract text from rich text array
function extractText(richTextArray) {
  if (!richTextArray || !Array.isArray(richTextArray) || richTextArray.length === 0) {
    return '';
  }
  return richTextArray.map(text => text.plain_text).join('');
}

// Helper: Extract property value
function extractProperty(page, propertyName) {
  const property = page.properties[propertyName];
  if (!property) return null;

  switch (property.type) {
    case 'title':
      return extractText(property.title);
    case 'rich_text':
      return extractText(property.rich_text);
    case 'select':
      return property.select ? property.select.name : null;
    case 'number':
      return property.number;
    case 'date':
      return property.date ? property.date.start : null;
    case 'url':
      return property.url;
    case 'multi_select':
      return property.multi_select ? property.multi_select.map(item => item.name) : [];
    default:
      return null;
  }
}

// Fetch KPIs
async function fetchKPIs() {
  try {
    const response = await notion.databases.query({
      database_id: KPIS_DB_ID,
    });

    return response.results.map(page => ({
      id: page.id,
      name: extractProperty(page, 'Name') || extractProperty(page, 'name') || 'Unknown',
      count: extractProperty(page, 'Count') || extractProperty(page, 'count') || 0,
    }));
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    throw new Error(`KPIs fetch failed: ${error.message}`);
  }
}

// Fetch Projects
async function fetchProjects() {
  try {
    const response = await notion.databases.query({
      database_id: PROJECTS_DB_ID,
    });

    return response.results.map(page => ({
      id: page.id,
      name: extractProperty(page, 'Name') || extractProperty(page, 'name') || 'Unknown',
      code: extractProperty(page, 'Code') || extractProperty(page, 'code'),
      kpi: extractProperty(page, 'KPI') || extractProperty(page, 'kpi'),
      division: extractProperty(page, 'Division') || extractProperty(page, 'division'),
      status: extractProperty(page, 'Status') || extractProperty(page, 'status'),
      owner: extractProperty(page, 'Owner') || extractProperty(page, 'owner'),
      progress: extractProperty(page, 'Progress') || extractProperty(page, 'progress') || 0,
      kpiDetail: extractProperty(page, 'KPI_Detail') || extractProperty(page, 'kpi_detail'),
      deadline: extractProperty(page, 'Deadline') || extractProperty(page, 'deadline'),
      link: extractProperty(page, 'Link') || extractProperty(page, 'link'),
    }));
  } catch (error) {
    console.error('Error fetching Projects:', error);
    throw new Error(`Projects fetch failed: ${error.message}`);
  }
}

// Main handler - VERCEL SERVERLESS FUNCTION FORMAT
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check environment variables
  if (!NOTION_TOKEN || !KPIS_DB_ID || !PROJECTS_DB_ID) {
    return res.status(500).json({
      error: 'Missing environment variables',
      message: 'Please set NOTION_TOKEN, KPIS_DB_ID, and PROJECTS_DB_ID in Vercel',
      debug: {
        hasToken: !!NOTION_TOKEN,
        hasKpisDb: !!KPIS_DB_ID,
        hasProjectsDb: !!PROJECTS_DB_ID,
      }
    });
  }

  try {
    const { type = 'all' } = req.query;

    let data = {};

    if (type === 'all' || type === 'kpis') {
      data.kpis = await fetchKPIs();
    }

    if (type === 'all' || type === 'projects') {
      data.projects = await fetchProjects();
    }

    return res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
