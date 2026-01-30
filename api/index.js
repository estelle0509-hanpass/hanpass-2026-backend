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

    // 페이지네이션으로 모든 프로젝트 가져오기
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: PROJECTS_DB_ID,
        start_cursor: startCursor,
        page_size: 100, // 한 번에 최대 100개
      });

      allProjects = allProjects.concat(response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`Total projects fetched: ${allProjects.length}`);

    return allProjects.map(page => {
      const props = page.properties;
      
      // KPI_Detail - Select 타입
      const kpiDetail = props.KPI_Detail?.select?.name || '';

      // Country - Multi-select 타입
      let country = '';
      if (props.Country?.multi_select) {
        country = props.Country.multi_select.map(c => c.name).join(', ');
      }

      // Owner - People 타입
      let owner = '';
      if (props.Owner?.people) {
        owner = props.Owner.people.map(p => p.name || p.id).join(', ');
      }

      // Division - Select 타입
      const division = props.Division?.select?.name || '';

      // Status - Select 타입
      const status = props.Status?.select?.name || '';

      // Goal - Rich Text 타입
      const goal = props.Goal?.rich_text?.[0]?.plain_text || '';

      // Deadline - Date 타입
      const deadline = props.Deadline?.date?.start || '';

      // Progress - Number 타입
      const progress = props.Progress?.number || 0;

      // KPI 1 - Relation 타입 (없으면 빈 문자열)
      const kpi = props['KPI 1']?.relation?.[0]?.id || '';

      // Link - 항상 Notion 페이지 URL
      const link = page.url;

      // Name - Title 타입
      const name = props.Name?.title?.[0]?.plain_text || '';

      return {
        id: page.id,
        name: name,
        country: country,
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing type parameter. Use: ?type=kpis, ?type=projects, or ?type=all' 
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

    if (type === 'all') {
      const [kpis, projects] = await Promise.all([
        getKPIs(),
        getProjects(),
      ]);
      return res.status(200).json({ 
        success: true, 
        data: { kpis, projects },
        count: { kpis: kpis.length, projects: projects.length },
        timestamp: new Date().toISOString()
      });
    }

    return res.status(400).json({ 
      success: false, 
      error: `Invalid type parameter: ${type}. Use: kpis, projects, or all` 
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
};
