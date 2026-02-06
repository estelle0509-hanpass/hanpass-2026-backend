const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const KPIS_DB_ID = process.env.KPIS_DB_ID || '2f673fbd1951802da1d1fd53cdd4e9bf';
const PROJECTS_DB_ID = process.env.PROJECTS_DB_ID || '2f673fbd195180d49315f97986496a16';

// KPI 데이터 가져오기
async function getKPIs() {
  try {
    const response = await notion.databases.query({
      database_id: KPIS_DB_ID,
      page_size: 100,
    });

    return response.results.map(page => {
      const props = page.properties;
      return {
        id: page.id,
        name: props.Name?.title?.[0]?.plain_text || 'Untitled',
        count: props.Count?.number || 0,
        projects: props.Projects?.relation || [],
      };
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    throw error;
  }
}

// 프로젝트 데이터 가져오기 (업데이트 시간 포함)
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
          // 업데이트 추적 정보 추가
          lastEditedTime: page.last_edited_time,
          createdTime: page.created_time,
          lastEditedBy: page.last_edited_by?.id || null,
        };
      });

      allProjects.push(...projects);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`✅ Total projects fetched: ${allProjects.length}`);
    return allProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
}

// 노션 페이지 내용(메모) 가져오기
async function getPageContent(pageId) {
  try {
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });

    // 텍스트 블록만 추출
    const content = blocks.results
      .map(block => {
        if (block.type === 'paragraph' && block.paragraph?.rich_text) {
          return block.paragraph.rich_text.map(t => t.plain_text).join('');
        } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
          return '• ' + block.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
        } else if (block.type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
          return '1. ' + block.numbered_list_item.rich_text.map(t => t.plain_text).join('');
        } else if (block.type === 'heading_1' && block.heading_1?.rich_text) {
          return '# ' + block.heading_1.rich_text.map(t => t.plain_text).join('');
        } else if (block.type === 'heading_2' && block.heading_2?.rich_text) {
          return '## ' + block.heading_2.rich_text.map(t => t.plain_text).join('');
        } else if (block.type === 'heading_3' && block.heading_3?.rich_text) {
          return '### ' + block.heading_3.rich_text.map(t => t.plain_text).join('');
        } else if (block.type === 'to_do' && block.to_do?.rich_text) {
          const checked = block.to_do.checked ? '[x]' : '[ ]';
          return checked + ' ' + block.to_do.rich_text.map(t => t.plain_text).join('');
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

// 여러 페이지의 내용 배치로 가져오기
async function getBatchPageContent(pageIds) {
  const contents = {};
  
  // 동시 요청 제한 (Notion API rate limit 대응)
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

// 데이터베이스 스키마 가져오기
async function getDatabaseSchema() {
  try {
    const database = await notion.databases.retrieve({
      database_id: PROJECTS_DB_ID,
    });

    console.log('[Schema Debug] Available properties:', Object.keys(database.properties));

    const schema = {
      countries: database.properties.Country?.multi_select?.options || [],
      divisions: database.properties.Division?.select?.options || [],
      statuses: database.properties.Status?.select?.options || [],
    };

    console.log('[Schema Debug] Schema result:', {
      countries: schema.countries.length,
      divisions: schema.divisions.length,
      statuses: schema.statuses.length,
    });

    return schema;
  } catch (error) {
    console.error('Error fetching schema:', error);
    throw error;
  }
}

// 프로젝트 업데이트
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

// 메인 핸들러
module.exports = async (req, res) => {
  // CORS 헤더 (OPTIONS 요청 먼저 처리)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  
  // Cache-Control 헤더 (캐시 완전 방지)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { type, projectId, includeContent } = req.query;

      if (type === 'kpis') {
        const kpis = await getKPIs();
        return res.json({
          success: true,
          data: kpis,
          count: kpis.length,
          timestamp: new Date().toISOString(),
        });
      }

      if (type === 'projects') {
        const projects = await getProjects();
        return res.json({
          success: true,
          data: projects,
          count: projects.length,
          timestamp: new Date().toISOString(),
        });
      }

      if (type === 'schema') {
        const schema = await getDatabaseSchema();
        return res.json({
          success: true,
          data: schema,
          timestamp: new Date().toISOString(),
        });
      }

      if (type === 'page-content' && projectId) {
        const content = await getPageContent(projectId);
        return res.json({
          success: true,
          data: { projectId, content },
          timestamp: new Date().toISOString(),
        });
      }

      if (type === 'all') {
        const [kpis, projects, schema] = await Promise.all([
          getKPIs(),
          getProjects(),
          getDatabaseSchema(),
        ]);

        const responseData = {
          kpis,
          projects,
          schema,
        };

        // includeContent=true면 페이지 내용도 포함
        if (includeContent === 'true') {
          const projectIds = projects.map(p => p.id);
          const contents = await getBatchPageContent(projectIds);
          
          // 각 프로젝트에 content 필드 추가
          responseData.projects = projects.map(p => ({
            ...p,
            content: contents[p.id] || '',
          }));
        }

        return res.json({
          success: true,
          data: responseData,
          count: {
            kpis: kpis.length,
            projects: projects.length,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid type parameter. Use: kpis, projects, schema, page-content, or all',
      });
    }

    if (req.method === 'POST') {
      const { projectId, goal, country, division, status, progress, deadline } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing projectId',
        });
      }

      // country 문자열을 배열로 변환
      const countryArray = country ? country.split(',').map(c => c.trim()) : [];

      const updates = {
        goal,
        country: countryArray,
        division,
        status,
        progress,
        deadline,
      };

      await updateProject(projectId, updates);
      return res.json({
        success: true,
        message: 'Project updated successfully',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
