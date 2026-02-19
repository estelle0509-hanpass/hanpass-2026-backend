const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const KPIS_DB_ID = process.env.KPIS_DB_ID || '2f673fbd1951802da1d1fd53cdd4e9bf';
const PROJECTS_DB_ID = process.env.PROJECTS_DB_ID || '2f673fbd195180d49315f97986496a16';

async function getKPIs() {
  try {
    let allKpis = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: KPIS_DB_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      const kpis = response.results.map(page => {
        const props = page.properties;
        return {
          id: page.id,
          name: props.Name?.title?.[0]?.plain_text || 'Untitled',
          count: props.Count?.number || 0,
          projects: props.Projects?.relation || [],
        };
      });

      allKpis = allKpis.concat(kpis);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    // 가나다순 정렬
    allKpis.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    console.log(`✅ Total KPIs fetched: ${allKpis.length}`);
    return allKpis;
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    throw error;
  }
}

async function getProjects() {
  const allProjects = [];
  let hasMore = true;
  let startCursor = undefined;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: PROJECTS_DB_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      const projects = response.results.map(page => {
        const props = page.properties;
        return {
          id: page.id,
          name: props['프로젝트명']?.title?.[0]?.plain_text || 'Untitled',
          country: props.Country?.multi_select?.map(s => s.name).join(', ') || '',
          countryArray: props.Country?.multi_select?.map(s => s.name) || [],
          deadline: props.Deadline?.date?.start || null,
          division: props.Division?.select?.name || '',
          goal: props['목표(Goal)']?.rich_text?.[0]?.plain_text || '',
          kpi: props.KPI?.relation?.[0]?.id || null,
          kpiDetail: props['KPI Detail']?.select?.name || '',
          link: page.url,
          owner: props['담당자']?.people?.map(p => p.name).join(', ') || '',
          progress: props.Progress?.number || 0,
          status: props.Status?.select?.name || '',
          lastEditedTime: page.last_edited_time,
          createdTime: page.created_time,
        };
      });

      allProjects.push(...projects);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    // 가나다순 정렬
    allProjects.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    console.log(`✅ Total projects fetched: ${allProjects.length}`);
    console.log(`📊 Projects breakdown:`, allProjects.map(p => ({ name: p.name, kpi: p.kpi })));
    
    return allProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
}

async function getPageContent(pageId) {
  try {
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });
    const content = blocks.results
      .map(block => {
        if (block.type === 'paragraph' && block.paragraph?.rich_text) {
          return block.paragraph.rich_text.map(t => t.plain_text).join('');
        } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
          return '• ' + block.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
        }
        return '';
      })
      .filter(text => text.trim() !== '')
      .join('\n');
    return content;
  } catch (error) {
    console.error(`Error fetching page content for ${pageId}:`, error);
    return '';
  }
}

async function getBatchPageContent(pageIds) {
  const contents = {};
  const batchSize = 5;
  for (let i = 0; i < pageIds.length; i += batchSize) {
    const batch = pageIds.slice(i, i + batchSize);
    const promises = batch.map(async pageId => {
      const content = await getPageContent(pageId);
      return { pageId, content };
    });
    const results = await Promise.all(promises);
    results.forEach(({ pageId, content }) => {
      contents[pageId] = content;
    });
  }
  return contents;
}

async function getDatabaseSchema() {
  try {
    const database = await notion.databases.retrieve({
      database_id: PROJECTS_DB_ID,
    });
    const schema = {
      countries: database.properties.Country?.multi_select?.options || [],
      divisions: database.properties.Division?.select?.options || [],
      statuses: database.properties.Status?.select?.options || [],
    };

    // 각 옵션도 가나다순 정렬
    schema.countries.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    schema.divisions.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    schema.statuses.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    return schema;
  } catch (error) {
    console.error('Error fetching schema:', error);
    throw error;
  }
}

async function updateProject(projectId, updates) {
  try {
    const properties = {};
    if (updates.progress !== undefined) {
      properties.Progress = { number: updates.progress };
    }
    if (updates.status) {
      properties.Status = { select: { name: updates.status } };
    }
    if (updates.deadline) {
      properties.Deadline = { date: { start: updates.deadline } };
    }
    if (updates.goal) {
      properties['목표(Goal)'] = {
        rich_text: [{ text: { content: updates.goal } }],
      };
    }
    if (updates.division) {
      properties.Division = { select: { name: updates.division } };
    }
    if (updates.country && Array.isArray(updates.country)) {
      properties.Country = {
        multi_select: updates.country.map(name => ({ name })),
      };
    }
    await notion.pages.update({
      page_id: projectId,
      properties,
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    if (pathname === '/api/getDatabaseSchema' && req.method === 'GET') {
      const schema = await getDatabaseSchema();
      return res.status(200).json(schema);
    }

    if (req.method === 'GET') {
      const { type, projectId, includeContent } = req.query;

      if (type === 'all') {
        const [kpis, projects, schema] = await Promise.all([
          getKPIs(),
          getProjects(),
          getDatabaseSchema(),
        ]);
        const responseData = { kpis, projects, schema };
        if (includeContent === 'true') {
          const projectIds = projects.map(p => p.id);
          const contents = await getBatchPageContent(projectIds);
          responseData.projects = projects.map(p => ({
            ...p,
            content: contents[p.id] || '',
          }));
        }
        return res.json({
          success: true,
          data: responseData,
          count: { kpis: kpis.length, projects: projects.length },
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid type parameter',
      });
    }

    if (req.method === 'POST') {
      const { projectId, goal, country, division, status, progress, deadline } = req.body;
      if (!projectId) {
        return res.status(400).json({ success: false, error: 'Missing projectId' });
      }
      const countryArray = Array.isArray(country) ? country : (country ? country.split(',').map(c => c.trim()) : []);
      const updates = { goal, country: countryArray, division, status, progress, deadline };
      await updateProject(projectId, updates);
      return res.json({
        success: true,
        message: 'Project updated successfully',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
