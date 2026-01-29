const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const KPIS_DB_ID = process.env.KPIS_DB_ID || '2f673fbd1951802da1d1fd53cdd4e9bf';
const PROJECTS_DB_ID = process.env.PROJECTS_DB_ID || '2f673fbd195180d49315f97986496a16';

async function getKPIs() {
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
}

async function getProjects() {
  const response = await notion.databases.query({
    database_id: PROJECTS_DB_ID,
  });

  return response.results.map(page => {
    const props = page.properties;
    return {
      id: page.id,
      name: props.Name?.title?.[0]?.plain_text || '',
      country: props.Country?.rich_text?.[0]?.plain_text || '',
      deadline: props.Deadline?.date?.start || '',
      division: props.Division?.select?.name || '',
      goal: props.Goal?.rich_text?.[0]?.plain_text || '',
      kpi: props['KPI 1']?.relation?.[0]?.id || '',
      kpiDetail: props.KPI_Detail?.rich_text?.[0]?.plain_text || '',
      link: props.Link?.url || page.url,
      owner: props.Owner?.rich_text?.[0]?.plain_text || '',
      progress: props.Progress?.number || 0,
      status: props.Status?.select?.name || '',
    };
  });
}

module.exports = async (req, res) => {
  try {
    const { type } = req.query;

    if (type === 'kpis') {
      const kpis = await getKPIs();
      return res.json({ success: true, data: kpis });
    }

    if (type === 'projects') {
      const projects = await getProjects();
      return res.json({ success: true, data: projects });
    }

    if (type === 'all') {
      const [kpis, projects] = await Promise.all([
        getKPIs(),
        getProjects(),
      ]);
      return res.json({ success: true, data: { kpis, projects } });
    }

    return res.status(400).json({ 
      success: false, 
      error: 'Invalid type parameter. Use: kpis, projects, or all' 
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
