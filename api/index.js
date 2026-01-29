// Vercel Serverless Function - Notion API Handler
// KPI → KPI_Detail → Projects 계층 구조

const https = require('https');

// Notion API 호출 함수
function notionRequest(path, method = 'POST', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// KPIs 데이터 조회
async function getKPIs() {
  const databaseId = process.env.KPIS_DB_ID;
  
  const response = await notionRequest(
    `/v1/databases/${databaseId}/query`,
    'POST',
    {}
  );

  return response.results.map(page => ({
    id: page.id,
    name: page.properties.Name?.title?.[0]?.plain_text || '',
    count: page.properties['갯수']?.rollup?.number || 0
  }));
}

// Projects 데이터 조회
async function getProjects() {
  const databaseId = process.env.PROJECTS_DB_ID;
  
  const response = await notionRequest(
    `/v1/databases/${databaseId}/query`,
    'POST',
    {}
  );

  return response.results.map(page => {
    const props = page.properties;
    
    // KPI Relation 처리
    const kpiRelation = props['KPI 1']?.relation?.[0] || props.KPI?.relation?.[0];
    const kpiName = kpiRelation ? 'relation' : (props['KPI 1']?.select?.name || props.KPI?.select?.name || '');
    
    return {
      id: page.id,
      name: props.Name?.title?.[0]?.plain_text || '',
      kpi: kpiName,
      kpi_detail: props.KPI_Detail?.rich_text?.[0]?.plain_text || '',
      country: props.Country?.rich_text?.[0]?.plain_text || '',
      division: props.Division?.select?.name || '',
      goal: props.Goal?.rich_text?.[0]?.plain_text || '',
      status: props.Status?.select?.name || '',
      progress: props.Progress?.number || 0,
      deadline: props.Deadline?.date?.start || '',
      owner: props.Owner?.people?.[0]?.name || '',
      link: page.url
    };
  });
}

// 프로젝트 업데이트
async function updateProject(projectId, updates) {
  const properties = {};
  
  if (updates.progress !== undefined) {
    properties.Progress = { number: parseInt(updates.progress) };
  }
  if (updates.status) {
    properties.Status = { select: { name: updates.status } };
  }
  if (updates.deadline) {
    properties.Deadline = { date: { start: updates.deadline } };
  }
  
  await notionRequest(
    `/v1/pages/${projectId}`,
    'PATCH',
    { properties }
  );
  
  return { success: true };
}

// 계층 구조 생성: KPI → KPI_Detail → Projects
function buildHierarchy(kpis, projects) {
  const hierarchy = [];
  
  // KPI별로 그룹화
  const kpiGroups = {};
  
  projects.forEach(project => {
    const kpi = project.kpi;
    const kpiDetail = project.kpi_detail || '기타';
    
    if (!kpiGroups[kpi]) {
      kpiGroups[kpi] = {};
    }
    
    if (!kpiGroups[kpi][kpiDetail]) {
      kpiGroups[kpi][kpiDetail] = [];
    }
    
    kpiGroups[kpi][kpiDetail].push(project);
  });
  
  // KPI 정보와 함께 계층 구조 생성
  kpis.forEach(kpi => {
    const kpiName = kpi.name;
    const details = kpiGroups[kpiName] || {};
    
    const detailGroups = Object.keys(details).map(detailName => ({
      name: detailName,
      projects: details[detailName]
    }));
    
    hierarchy.push({
      kpi: kpiName,
      count: kpi.count,
      details: detailGroups
    });
  });
  
  return hierarchy;
}

// 메인 핸들러
module.exports = async (req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { type, projectId, updates } = req.method === 'POST' ? req.body : {};
    const queryType = type || req.query.type || 'all';
    
    // 환경변수 확인
    if (!process.env.NOTION_TOKEN || !process.env.KPIS_DB_ID || !process.env.PROJECTS_DB_ID) {
      return res.status(500).json({
        error: 'Missing environment variables',
        message: 'Please set NOTION_TOKEN, KPIS_DB_ID, and PROJECTS_DB_ID'
      });
    }
    
    // 프로젝트 업데이트
    if (req.method === 'POST' && projectId) {
      const result = await updateProject(projectId, updates);
      return res.status(200).json(result);
    }
    
    // 데이터 조회
    const [kpis, projects] = await Promise.all([
      getKPIs(),
      getProjects()
    ]);
    
    if (queryType === 'hierarchy') {
      // 계층 구조 반환
      const hierarchy = buildHierarchy(kpis, projects);
      return res.status(200).json({
        success: true,
        data: hierarchy,
        timestamp: new Date().toISOString()
      });
    }
    
    // 전체 데이터 반환
    return res.status(200).json({
      success: true,
      data: {
        kpis,
        projects,
        hierarchy: buildHierarchy(kpis, projects)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};
