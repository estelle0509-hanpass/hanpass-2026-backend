const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const KPIS_DB_ID = process.env.KPIS_DB_ID || '2f673fbd1951802da1d1fd53cdd4e9bf';
const PROJECTS_DB_ID = process.env.PROJECTS_DB_ID || '2f673fbd195180d49315f97986496a16';

async function getKPIs() {
  try {
    const response = await notion.databases.query({
      database_id: KPIS_DB_ID,
    });

    return response.results.map(page => {
      const props = page.properties;
      return {
        id: page.id,
        name: props.Name?.title?.[0]?.plain_text || '',
        count: props['갯수']?.number || 0,
        projects: props['Notion_Projects.csv']?.relation || [],
      };
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    throw error;
  }
}

async function getProjects() {
  try {
    let allProjects = [];
    let hasMore = true;
    let startCursor = undefined;

    // 모든 프로젝트 가져오기 (페이지네이션)
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: PROJECTS_DB_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      allProjects = allProjects.concat(response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`Total projects fetched: ${allProjects.length}`);

    return allProjects.map(page => {
      const props = page.properties;
      
      const kpiDetail = props.KPI_Detail?.select?.name || '';

      let country = '';
      let countryArray = [];
      if (props.Country?.multi_select) {
        countryArray = props.Country.multi_select.map(c => c.name);
        country = countryArray.join(', ');
      }

      let owner = '';
      if (props.Owner?.people) {
        owner = props.Owner.people.map(p => p.name || p.id).join(', ');
      }

      const division = props.Division?.select?.name || '';
      const status = props.Status?.select?.name || '';
      const goal = props.Goal?.rich_text?.[0]?.plain_text || '';
      const deadline = props.Deadline?.date?.start || '';
      const progress = props.Progress?.number || 0;
      const kpi = props['KPI 1']?.relation?.[0]?.id || '';
      const link = page.url;
      const name = props.Name?.title?.[0]?.plain_text || '';

      return {
        id: page.id,
        name: name,
        country: country,
        countryArray: countryArray,
        deadline: deadline,
        division: division,
        goal: goal,
        kpi: kpi,
        kpiDetail: kpiDetail,
        link: link,
        owner: owner,
        progress: progress,
        status: status,
      };
    });
  } catch (error) {
    console.error('Error fetching Projects:', error);
    throw error;
  }
}

// 데이터베이스 메타데이터 조회 (Select 옵션들)
async function getDatabaseSchema() {
  try {
    const database = await notion.databases.retrieve({
      database_id: PROJECTS_DB_ID
    });

    const countryOptions = database.properties.Country?.multi_select?.options || [];
    const divisionOptions = database.properties.Division?.select?.options || [];
    const statusOptions = database.properties.Status?.select?.options || [];

    return {
      countryOptions: countryOptions.map(o => o.name),
      divisionOptions: divisionOptions.map(o => o.name),
      statusOptions: statusOptions.map(o => o.name)
    };
  } catch (error) {
    console.error('Error fetching database schema:', error);
    return {
      countryOptions: [],
      divisionOptions: [],
      statusOptions: []
    };
  }
}

// 프로젝트 업데이트
async function updateProject(projectId, updates) {
  try {
    const properties = {};

    // Progress (Number)
    if (updates.progress !== undefined) {
      properties.Progress = { number: updates.progress };
    }

    // Status (Select)
    if (updates.status !== undefined && updates.status !== '') {
      properties.Status = { select: { name: updates.status } };
    }

    // Deadline (Date)
    if (updates.deadline !== undefined) {
      if (updates.deadline === '') {
        properties.Deadline = { date: null };
      } else {
        properties.Deadline = { date: { start: updates.deadline } };
      }
    }

    // Goal (Rich Text)
    if (updates.goal !== undefined) {
      properties.Goal = { 
        rich_text: [{ text: { content: updates.goal } }] 
      };
    }

    // Division (Select) - 기존 옵션만
    if (updates.division !== undefined && updates.division !== '') {
      properties.Division = { select: { name: updates.division } };
    }

    // Country (Multi-select) - 배열로 전달
    if (updates.country !== undefined) {
      if (Array.isArray(updates.country)) {
        properties.Country = { 
          multi_select: updates.country.map(name => ({ name })) 
        };
      } else {
        properties.Country = { multi_select: [] };
      }
    }

    console.log('Updating project:', projectId, properties);

    const response = await notion.pages.update({
      page_id: projectId,
      properties: properties
    });

    return { success: true, data: response };
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  // 🔥 CORS 헤더 - 반드시 먼저 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  
  // 🔥 캐시 방지 헤더
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET 요청: 데이터 조회
    if (req.method === 'GET') {
      const { type } = req.query;

      if (!type) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing type parameter. Use: ?type=kpis, ?type=projects, ?type=all, or ?type=schema' 
        });
      }

      if (type === 'kpis') {
        const kpis = await getKPIs();
        return res.status(200).json({ 
          success: true, 
          data: kpis, 
          count: kpis.length,
          timestamp: new Date().toISOString() 
        });
      }

      if (type === 'projects') {
        const projects = await getProjects();
        return res.status(200).json({ 
          success: true, 
          data: projects,
          count: projects.length,
          timestamp: new Date().toISOString() 
        });
      }

      if (type === 'schema') {
        const schema = await getDatabaseSchema();
        return res.status(200).json({ 
          success: true, 
          data: schema,
          timestamp: new Date().toISOString() 
        });
      }

      if (type === 'all') {
        const [kpis, projects, schema] = await Promise.all([
          getKPIs(),
          getProjects(),
          getDatabaseSchema()
        ]);
        return res.status(200).json({ 
          success: true, 
          data: { kpis, projects, schema },
          count: { kpis: kpis.length, projects: projects.length },
          timestamp: new Date().toISOString()
        });
      }

      return res.status(400).json({ 
        success: false, 
        error: `Invalid type parameter: ${type}. Use: kpis, projects, schema, or all` 
      });
    }

    // POST 요청: 프로젝트 업데이트
    if (req.method === 'POST') {
      const { projectId, updates } = req.body;

      if (!projectId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing projectId in request body' 
        });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing updates in request body' 
        });
      }

      const result = await updateProject(projectId, updates);
      return res.status(200).json(result);
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use GET or POST' 
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
};
