// Vercel Serverless Function for Notion API with UPDATE support
const { Client } = require('@notionhq/client');

// Environment variables
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const KPIS_DB_ID = process.env.KPIS_DB_ID;
const PROJECTS_DB_ID = process.env.PROJECTS_DB_ID;
const SYNC_PASSWORD = process.env.SYNC_PASSWORD || 'hanpass2026';

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
      country: extractProperty(page, 'Country') || extractProperty(page, 'country'),
      status: extractProperty(page, 'Status') || extractProperty(page, 'status'),
      owner: extractProperty(page, 'Owner') || extractProperty(page, 'owner'),
      goal: extractProperty(page, 'Goal') || extractProperty(page, 'goal'),
      progress: extractProperty(page, 'Progress') || extractProperty(page, 'progress') || 0,
      deadline: extractProperty(page, 'Deadline') || extractProperty(page, 'deadline'),
    }));
  } catch (error) {
    console.error('Error fetching Projects:', error);
    throw new Error(`Projects fetch failed: ${error.message}`);
  }
}

// Update Project
async function updateProject(projectId, updates) {
  try {
    const properties = {};

    if (updates.name !== undefined) {
      properties.Name = { title: [{ text: { content: updates.name } }] };
    }
    if (updates.division !== undefined) {
      properties.Division = { select: { name: updates.division } };
    }
    if (updates.country !== undefined) {
      properties.Country = { rich_text: [{ text: { content: updates.country } }] };
    }
    if (updates.owner !== undefined) {
      properties.Owner = { rich_text: [{ text: { content: updates.owner } }] };
    }
    if (updates.goal !== undefined) {
      properties.Goal = { rich_text: [{ text: { content: updates.goal } }] };
    }
    if (updates.progress !== undefined) {
      properties.Progress = { number: parseInt(updates.progress) || 0 };
    }
    if (updates.deadline !== undefined) {
      properties.Deadline = { date: { start: updates.deadline } };
    }
    if (updates.status !== undefined) {
      properties.Status = { select: { name: updates.status } };
    }

    await notion.pages.update({
      page_id: projectId,
      properties: properties,
    });

    return { success: true, projectId };
  } catch (error) {
    console.error('Error updating project:', error);
    throw new Error(`Project update failed: ${error.message}`);
  }
}

// Main handler
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!NOTION_TOKEN || !KPIS_DB_ID || !PROJECTS_DB_ID) {
    return res.status(500).json({
      error: 'Missing environment variables',
    });
  }

  try {
    if (req.method === 'GET') {
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
    }

    if (req.method === 'POST') {
      const { password, updates } = req.body;

      if (password !== SYNC_PASSWORD) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: '비밀번호가 올바르지 않습니다.',
        });
      }

      const results = [];
      for (const update of updates) {
        try {
          const result = await updateProject(update.id, update.data);
          results.push(result);
        } catch (error) {
          results.push({ success: false, projectId: update.id, error: error.message });
        }
      }

      return res.status(200).json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
