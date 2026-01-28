// Vercel Serverless Function
// Notion API를 호출하는 백엔드 (디버깅 버전)

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 환경 변수에서 Notion 설정 가져오기
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const KPIS_DB_ID = process.env.KPIS_DB_ID;
  const PROJECTS_DB_ID = process.env.PROJECTS_DB_ID;

  // 환경 변수 확인
  if (!NOTION_TOKEN || !KPIS_DB_ID || !PROJECTS_DB_ID) {
    return res.status(500).json({
      error: 'Missing environment variables',
      message: 'Please set NOTION_TOKEN, KPIS_DB_ID, and PROJECTS_DB_ID in Vercel environment variables',
      debug: {
        hasToken: !!NOTION_TOKEN,
        hasKpisId: !!KPIS_DB_ID,
        hasProjectsId: !!PROJECTS_DB_ID
      }
    });
  }

  try {
    // 요청 타입 확인
    const { type } = req.query;

    if (type === 'kpis') {
      // KPIs 데이터 가져오기
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
        const errorText = await response.text();
        throw new Error(`KPIs fetch failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // 디버깅: 원본 데이터 로그
      console.log('KPIs raw data:', JSON.stringify(data, null, 2));
      
      // 데이터 파싱 (안전하게)
      const kpis = data.results.map(page => {
        const props = page.properties;
        
        // 디버깅: 각 페이지의 properties 구조 로그
        console.log('Page properties:', Object.keys(props));
        
        return {
          id: page.id,
          name: props.Name?.title?.[0]?.plain_text || props.name?.title?.[0]?.plain_text || 'Unknown',
          count: props.Count?.number || props.count?.number || 0
        };
      });

      return res.status(200).json({ success: true, data: kpis });

    } else if (type === 'projects') {
      // Projects 데이터 가져오기
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
        const errorText = await response.text();
        throw new Error(`Projects fetch failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // 디버깅: 원본 데이터 로그
      console.log('Projects raw data:', JSON.stringify(data.results[0], null, 2));
      
      // 데이터 파싱 (안전하게)
      const projects = data.results.map(page => {
        const props = page.properties;
        
        return {
          id: page.id,
          name: props.Name?.title?.[0]?.plain_text || props.name?.title?.[0]?.plain_text || 'Unknown',
          code: props.Code?.rich_text?.[0]?.plain_text || props.code?.rich_text?.[0]?.plain_text || '',
          kpi: props.KPI?.select?.name || props.kpi?.select?.name || '',
          division: props.Division?.select?.name || props.division?.select?.name || '',
          status: props.Status?.select?.name || props.status?.select?.name || '',
          owner: props.Owner?.rich_text?.[0]?.plain_text || props.owner?.rich_text?.[0]?.plain_text || '',
          progress: props.Progress?.number || props.progress?.number || 0,
          kpiDetail: props.KPI_Detail?.rich_text?.[0]?.plain_text || props.kpi_detail?.rich_text?.[0]?.plain_text || '',
          deadline: props.Deadline?.date?.start || props.deadline?.date?.start || '',
          link: props.Link?.url || props.link?.url || ''
        };
      });

      return res.status(200).json({ success: true, data: projects });

    } else if (type === 'all') {
      // 모든 데이터 한 번에 가져오기
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

      if (!kpisResponse.ok) {
        const errorText = await kpisResponse.text();
        throw new Error(`KPIs fetch failed: ${kpisResponse.status} - ${errorText}`);
      }
      
      if (!projectsResponse.ok) {
        const errorText = await projectsResponse.text();
        throw new Error(`Projects fetch failed: ${projectsResponse.status} - ${errorText}`);
      }

      const [kpisData, projectsData] = await Promise.all([
        kpisResponse.json(),
        projectsResponse.json()
      ]);

      // KPIs 파싱 (안전하게)
      const kpis = kpisData.results.map(page => {
        const props = page.properties;
        return {
          id: page.id,
          name: props.Name?.title?.[0]?.plain_text || props.name?.title?.[0]?.plain_text || 'Unknown',
          count: props.Count?.number || props.count?.number || 0
        };
      });

      // Projects 파싱 (안전하게)
      const projects = projectsData.results.map(page => {
        const props = page.properties;
        return {
          id: page.id,
          name: props.Name?.title?.[0]?.plain_text || props.name?.title?.[0]?.plain_text || 'Unknown',
          code: props.Code?.rich_text?.[0]?.plain_text || props.code?.rich_text?.[0]?.plain_text || '',
          kpi: props.KPI?.select?.name || props.kpi?.select?.name || '',
          division: props.Division?.select?.name || props.division?.select?.name || '',
          status: props.Status?.select?.name || props.status?.select?.name || '',
          owner: props.Owner?.rich_text?.[0]?.plain_text || props.owner?.rich_text?.[0]?.plain_text || '',
          progress: props.Progress?.number || props.progress?.number || 0,
          kpiDetail: props.KPI_Detail?.rich_text?.[0]?.plain_text || props.kpi_detail?.rich_text?.[0]?.plain_text || '',
          deadline: props.Deadline?.date?.start || props.deadline?.date?.start || '',
          link: props.Link?.url || props.link?.url || ''
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          kpis,
          projects
        }
      });

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
      message: error.message,
      stack: error.stack
    });
  }
}
