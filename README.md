# 한패스 2026 경영기획 대시보드 백엔드

> Notion API를 통해 KPI와 프로젝트 데이터를 제공하는 백엔드 서버

---

## 🎯 **개요**

이 백엔드는 Notion 데이터베이스에서 실시간으로 KPI와 프로젝트 데이터를 가져와 프런트엔드에 제공합니다.

---

## 📁 **파일 구조**

```
hanpass-2026-backend/
├── api/
│   └── notion.js          # Notion API 핸들러
├── vercel.json            # Vercel 배포 설정
├── package.json           # 의존성 패키지
└── README.md              # 이 문서
```

---

## 🚀 **배포 방법**

### **Step 1: GitHub 저장소 생성**

1. GitHub에서 새 저장소 생성
   - 저장소 이름: `hanpass-2026-backend`
   - Public/Private: 둘 다 가능

2. 모든 파일 업로드
   ```
   api/notion.js
   vercel.json
   package.json
   README.md
   ```

---

### **Step 2: Vercel 배포**

1. Vercel 대시보드: https://vercel.com/dashboard
2. **Import Project** 클릭
3. GitHub에서 `hanpass-2026-backend` 선택
4. **Environment Variables** 설정:

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NOTION_TOKEN` | Notion Integration Token | `ntn_xxxxx...` |
| `KPIS_DB_ID` | KPIs 데이터베이스 ID | `2f673fbd1951802da1d1fd53cdd4e9bf` |
| `PROJECTS_DB_ID` | Projects 데이터베이스 ID | `2f673fbd195180d49315f97986496a16` |

5. **Deploy** 클릭

---

### **Step 3: 배포 확인**

배포가 완료되면 다음 URL로 테스트:

```
https://your-project.vercel.app/api/notion?type=all
```

**성공 응답 예시:**
```json
{
  "success": true,
  "data": {
    "kpis": [
      {"id": "...", "name": "MAU", "count": 23}
    ],
    "projects": [...]
  }
}
```

---

## 🔧 **환경 변수 설정**

### **NOTION_TOKEN**
- Notion Integration Secret
- 획득 방법: https://www.notion.so/my-integrations

### **KPIS_DB_ID**
- KPIs 데이터베이스 ID (32자)
- URL에서 추출: `https://www.notion.so/{DATABASE_ID}?v=...`

### **PROJECTS_DB_ID**
- Projects 데이터베이스 ID (32자)
- URL에서 추출: 위와 동일

---

## 📊 **API 엔드포인트**

### **GET /api/notion**

**Query Parameters:**
- `type=all` : 모든 데이터 (KPIs + Projects)
- `type=kpis` : KPI 데이터만
- `type=projects` : 프로젝트 데이터만

**응답 형식:**
```json
{
  "success": true,
  "data": {
    "kpis": [...],
    "projects": [...]
  }
}
```

---

## 🛠️ **문제 해결**

### **401 Unauthorized**
- NOTION_TOKEN이 유효하지 않음
- Integration을 다시 생성하고 토큰을 갱신하세요

### **404 Object not found**
- Database ID가 잘못되었거나
- Integration이 해당 데이터베이스에 연결되지 않음
- Notion에서 Connection 추가 필요

### **500 Internal Server Error**
- Vercel 로그 확인: Dashboard > Deployments > Functions > Logs
- 데이터베이스 구조 확인

---

## ✅ **체크리스트**

- [ ] GitHub 저장소 생성
- [ ] 모든 파일 업로드 (api/notion.js, vercel.json, package.json, README.md)
- [ ] Vercel Import Project
- [ ] 환경 변수 3개 설정 (NOTION_TOKEN, KPIS_DB_ID, PROJECTS_DB_ID)
- [ ] Deploy 실행
- [ ] API 테스트 (`/api/notion?type=all`)
- [ ] 프런트엔드 연결

---

## 📞 **지원**

문제가 발생하면 다음 정보를 확인하세요:
- Vercel 배포 로그
- Notion Integration 연결 상태
- 환경 변수 설정

---

**Made with ❤️ for 한패스 2026**
