const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const PROJECTS_DATABASE_ID = '2f673fbd195180d49315f97986496a16';
const KPI_DATABASE_ID = '2f673fbd1951802da1d1fd53cdd4e9bf';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS preflight
function handleOptions(res) {
  res.writeHead(204, corsHeaders);
  res.end();
}

// Get database schema
async function getDatabaseSchema(databaseId) {
  try {
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    });
    
    const schema = {};
    for (const [propName, propConfig] of Object.entries(database.properties)) {
      schema[propName] = {
        type: propConfig.type,
        id: propConfig.id
      };
      
      if (propConfig.type === 'select' && propConfig.select) {
        schema[propName].options = propConfig.select.options.map(opt => opt.name);
      } else if (propConfig.type === 'multi_select' && propConfig.multi_select) {
        schema[propName].options = propConfig.multi_select.options.map(opt => opt.name);
      } else if (propConfig.type === 'status' && propConfig.status) {
        schema[propName].options = propConfig.status.options.map(opt => opt.name);
      }
    }
    
    return schema;
  } catch (error) {
    console.error('Error fetching database schema:', error);
    throw error;
  }
}

// Parse property value from Notion
function parsePropertyValue(property) {
  if (!property) return null;

  switch (property.type) {
    case 'title':
      return property.title.map(t => t.plain_text).join('');
    case 'rich_text':
      return property.rich_text.map(t => t.plain_text).join('');
    case 'number':
      return property.number;
    case 'select':
      return property.select ? property.select.name : null;
    case 'multi_select':
      return property.multi_select.map(s => s.name);
    case 'date':
      return property.date ? property.date.start : null;
    case 'checkbox':
      return property.checkbox;
    case 'url':
      return property.url;
    case 'email':
      return property.email;
    case 'phone_number':
      return property.phone_number;
    case 'status':
      return property.status ? property.status.name : null;
    case 'people':
      return property.people.map(p => p.name || p.id);
    case 'files':
      return property.files.map(f => f.name || f.file?.url || f.external?.url);
    case 'relation':
      return property.relation.map(r => r.id);
    case 'rollup':
      if (property.rollup.type === 'number') return property.rollup.number;
      if (property.rollup.type === 'array') return property.rollup.array;
      return null;
    case 'formula':
      if (property.formula.type === 'number') return property.formula.number;
      if (property.formula.type === 'string') return property.formula.string;
      if (property.formula.type === 'boolean') return property.formula.boolean;
      if (property.formula.type === 'date') return property.formula.date;
      return null;
    default:
      return null;
  }
}

// Fetch all pages from database
async function fetchAllPages(databaseId) {
  let allPages = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: startCursor,
      page_size: 100,
    });

    allPages = allPages.concat(response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor;
  }

  return allPages;
}

// Get all data
async function getAllData() {
  try {
    const [projectPages, kpiPages] = await Promise.all([
      fetchAllPages(PROJECTS_DATABASE_ID),
      fetchAllPages(KPI_DATABASE_ID),
    ]);

    const projects = projectPages.map(page => {
      const properties = {};
      for (const [key, value] of Object.entries(page.properties)) {
        properties[key] = parsePropertyValue(value);
      }
      return {
        id: page.id,
        ...properties,
        last_edited_time: page.last_edited_time,
      };
    });

    const kpis = kpiPages.map(page => {
      const properties = {};
      for (const [key, value] of Object.entries(page.properties)) {
        properties[key] = parsePropertyValue(value);
      }
      return {
        id: page.id,
        ...properties,
        last_edited_time: page.last_edited_time,
      };
    });

    return { projects, kpis };
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

// Update project
async function updateProject(pageId, updates) {
  try {
    const properties = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined) continue;
      
      // Get property type from database schema
      const database = await notion.databases.retrieve({
        database_id: PROJECTS_DATABASE_ID,
      });
      
      const propConfig = database.properties[key];
      if (!propConfig) continue;
      
      switch (propConfig.type) {
        case 'title':
          properties[key] = {
            title: [{ text: { content: String(value) } }]
          };
          break;
        case 'rich_text':
          properties[key] = {
            rich_text: [{ text: { content: String(value) } }]
          };
          break;
        case 'number':
          properties[key] = {
            number: Number(value)
          };
          break;
        case 'select':
          properties[key] = {
            select: { name: String(value) }
          };
          break;
        case 'multi_select':
          properties[key] = {
            multi_select: Array.isArray(value) 
              ? value.map(v => ({ name: String(v) }))
              : [{ name: String(value) }]
          };
          break;
        case 'date':
          properties[key] = {
            date: { start: String(value) }
          };
          break;
        case 'checkbox':
          properties[key] = {
            checkbox: Boolean(value)
          };
          break;
        case 'url':
          properties[key] = {
            url: String(value)
          };
          break;
        case 'email':
          properties[key] = {
            email: String(value)
          };
          break;
        case 'phone_number':
          properties[key] = {
            phone_number: String(value)
          };
          break;
        case 'status':
          properties[key] = {
            status: { name: String(value) }
          };
          break;
      }
    }
    
    const response = await notion.pages.update({
      page_id: pageId,
      properties: properties,
    });
    
    return response;
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
}

// Main handler
module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(res);
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const queryType = url.searchParams.get('type');

    // GET /api/getDatabaseSchema
    if (pathname === '/api/getDatabaseSchema' && req.method === 'GET') {
      const schema = await getDatabaseSchema(PROJECTS_DATABASE_ID);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(schema));
    }

    // GET /api?type=all
    if (pathname === '/api' && req.method === 'GET' && queryType === 'all') {
      const data = await getAllData();
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(data));
    }

    // POST /api (update project)
    if (pathname === '/api' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const { pageId, updates } = JSON.parse(body);
          
          if (!pageId || !updates) {
            res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing pageId or updates' }));
          }
          
          const result = await updateProject(pageId, updates);
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } catch (error) {
          console.error('Error in POST handler:', error);
          res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 
            error: 'Failed to update project',
            details: error.message 
          }));
        }
      });
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    
  } catch (error) {
