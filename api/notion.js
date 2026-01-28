// Vercel Serverless Function - Notion API 백엔드
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 환경 변수
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const KPIS_DB_ID = process.env.KPIS_DB_ID;
  const PROJECTS_DB_ID = process.env.PROJECTS_DB_ID;

  if (!NOTION_TOKEN || !KPIS_DB_ID || !PROJECTS_DB_ID) {
    return res.status(500).json({
      error: 'Missing environment variables',
      message: 'NOTION_TOKEN, KPIS_DB_ID, PROJECTS_DB_ID required'
    });
  }

  try {
    const { type } = req.query;

    if (type === 'all') {
      // 모든 데이터 가져오기
      const [kpisResponse, projectsResponse] = await Promise.all([
        fetch(`https://api.notion.com/v1/databases/${KPIS_DB_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }),
        fetch(`https://api.notion.com/v1/databases/${PROJECTS_DB_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        })
      ]);

      if (!kpisResponse.ok || !projectsResponse.ok) {
        const kpisError = !kpisResponse.ok ? await kpisResponse.text() : null;
        const projectsError = !projectsResponse.ok ? await projectsResponse.text() : null;
        throw new Error(`API Error - KPIs: ${kpisError || 'OK'}, Projects: ${projectsError || 'OK'}`);
      }

      const [kpisData, projectsData] = await Promise.all([
        kpisResponse.json(),
        projectsResponse.json()
      ]);

      // KPIs 파싱
      const kpis = kpisData.results.map(page => {
        const props = page.properties;
        const nameProperty = props.Name || props.name || props.title;
        const countProperty = props.Count || props.count;
        
        return {
          id: page.id,
          name: nameProperty?.title?.[0]?.plain_text || 'Unknown',
          count: countProperty?.number || 0
        };
      });

      // Projects 파싱
      const projects = projectsData.results.map(page => {
        const props = page.properties;
        
        const getName = () => {
          const p = props.Name || props.name || props.title;
          return p?.title?.[0]?.plain_text || 'Unknown';
        };
        
        const getTextProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (p?.rich_text?.[0]?.plain_text) return p.rich_text[0].plain_text;
          }
          return '';
        };
        
        const getSelectProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (p?.select?.name) return p.select.name;
          }
          return '';
        };
        
        const getNumberProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (typeof p?.number === 'number') return p.number;
          }
          return 0;
        };
        
        const getDateProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (p?.date?.start) return p.date.start;
          }
          return '';
        };
        
        const getUrlProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (p?.url) return p.url;
          }
          return '';
        };
        
        return {
          id: page.id,
          name: getName(),
          code: getTextProp(['Code', 'code']),
          kpi: getSelectProp(['KPI', 'kpi']),
          division: getSelectProp(['Division', 'division']),
          status: getSelectProp(['Status', 'status']),
          owner: getTextProp(['Owner', 'owner']),
          progress: getNumberProp(['Progress', 'progress']),
          kpiDetail: getTextProp(['KPI_Detail', 'kpi_detail', 'KPI Detail']),
          deadline: getDateProp(['Deadline', 'deadline']),
          link: getUrlProp(['Link', 'link'])
        };
      });

      return res.status(200).json({
        success: true,
        data: { kpis, projects }
      });

    } else if (type === 'kpis') {
      const response = await fetch(`https://api.notion.com/v1/databases/${KPIS_DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`KPIs fetch failed: ${response.status}`);
      }

      const data = await response.json();
      const kpis = data.results.map(page => {
        const props = page.properties;
        const nameProperty = props.Name || props.name || props.title;
        const countProperty = props.Count || props.count;
        
        return {
          id: page.id,
          name: nameProperty?.title?.[0]?.plain_text || 'Unknown',
          count: countProperty?.number || 0
        };
      });

      return res.status(200).json({ success: true, data: kpis });

    } else if (type === 'projects') {
      const response = await fetch(`https://api.notion.com/v1/databases/${PROJECTS_DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Projects fetch failed: ${response.status}`);
      }

      const data = await response.json();
      const projects = data.results.map(page => {
        const props = page.properties;
        
        const getName = () => {
          const p = props.Name || props.name || props.title;
          return p?.title?.[0]?.plain_text || 'Unknown';
        };
        
        const getTextProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (p?.rich_text?.[0]?.plain_text) return p.rich_text[0].plain_text;
          }
          return '';
        };
        
        const getSelectProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (p?.select?.name) return p.select.name;
          }
          return '';
        };
        
        const getNumberProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (typeof p?.number === 'number') return p.number;
          }
          return 0;
        };
        
        const getDateProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (p?.date?.start) return p.date.start;
          }
          return '';
        };
        
        const getUrlProp = (names) => {
          for (const name of names) {
            const p = props[name];
            if (p?.url) return p.url;
          }
          return '';
        };
        
        return {
          id: page.id,
          name: getName(),
          code: getTextProp(['Code', 'code']),
          kpi: getSelectProp(['KPI', 'kpi']),
          division: getSelectProp(['Division', 'division']),
          status: getSelectProp(['Status', 'status']),
          owner: getTextProp(['Owner', 'owner']),
          progress: getNumberProp(['Progress', 'progress']),
          kpiDetail: getTextProp(['KPI_Detail', 'kpi_detail', 'KPI Detail']),
          deadline: getDateProp(['Deadline', 'deadline']),
          link: getUrlProp(['Link', 'link'])
        };
      });

      return res.status(200).json({ success: true, data: projects });

    } else {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Please specify type: kpis, projects, or all'
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
