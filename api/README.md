# 한패스 2026 경영기획 - Notion 연동 (Vercel 백엔드)

## 🎯 프로젝트 구조

```
hanpass-2026-backend/
├── api/
│   └── notion.js          # Vercel Serverless Function
├── vercel.json            # Vercel 설정
├── package.json           # 패키지 정보
└── README.md              # 이 파일
```

---

## 🚀 배포 가이드

### **Step 1: GitHub 저장소 생성**

1. **GitHub에서 새 저장소 생성**
   - 이름: `hanpass-2026-backend`
   - Public/Private 선택
   - README 추가 체크 해제

2. **파일 업로드**
   ```
   api/notion.js
   vercel.json
   package.json
   README.md
   ```

---

### **Step 2: Vercel 계정 생성 및 배포**

#### **2-1. Vercel 가입**

1. https://vercel.com 접속
2. **Sign Up** 클릭
3. **Continue with GitHub** 선택
4. GitHub 계정 연동

#### **2-2. 프로젝트 배포**

1. Vercel 대시보드에서 **"Add New..."** → **"Project"** 클릭
2. **Import Git Repository** 섹션에서 `hanpass-2026-backend` 선택
3. **Import** 클릭

#### **2-3. 환경 변수 설정 (중요!)**

**Environment Variables** 섹션에서 다음 3개 변수를 추가하세요:

| Key | Value |
|-----|-------|
| `NOTION_TOKEN` | Notion Integration Token (ntn_으로 시작) |
| `KPIS_DB_ID` | KPIs 데이터베이스 ID (32자 영숫자) |
| `PROJECTS_DB_ID` | Projects 데이터베이스 ID (32자 영숫자) |

**⚠️ Token 값은 별도로 안전하게 보관하세요!**

**Environment:** `Production`, `Preview`, `Development` 모두 체크

#### **2-4. 배포**

1. **Deploy** 클릭
2. 2-3분 대기
3. ✅ 배포 완료!
4. **배포 URL 복사** (예: `https://hanpass-2026-backend.vercel.app`)

---

### **Step 3: GitHub Pages에 프론트엔드 배포**

#### **3-1. index.html 수정**

파일: `index_vercel.html`

변경:
```javascript
// 이 줄을 찾아서
const VERCEL_API_URL = 'YOUR_VERCEL_URL_HERE';

// Vercel 배포 URL로 변경
const VERCEL_API_URL = 'https://your-project.vercel.app';
```

#### **3-2. GitHub Pages에 업로드**

1. 기존 `hanpass-2026` 저장소로 이동
2. 수정한 `index_vercel.html`을 `index.html`로 이름 변경
3. GitHub에 업로드
4. Commit: `Notion 연동 (Vercel 백엔드)`

---

### **Step 4: 테스트**

1. **배포 URL 접속:**  
   https://estelle0509-hanpass.github.io/hanpass-2026/

2. **API 테스트 버튼 클릭**
   - ✅ "API 연결 성공!" 메시지 확인

3. **"Notion에서 데이터 로드" 클릭**
   - ✅ 총 KPI: 5개
   - ✅ 총 프로젝트: 145개
   - ✅ 모든 데이터 표시

---

## 🔐 보안

### ✅ **안전한 구조**

```
GitHub Pages (프론트엔드)
  - index.html만 노출
  - Token 없음 ✅

     ↓ AJAX 요청

Vercel Functions (백엔드)
  - 환경 변수에 Token 저장 🔐
  - 코드는 공개되지 않음
  - Token은 절대 노출 안 됨 ✅

     ↓ API 호출

Notion API
  - 안전하게 데이터 전달
```

---

## 📱 사용 방법

### **모바일/PC/태블릿 어디서나:**

1. URL 접속:  
   https://estelle0509-hanpass.github.io/hanpass-2026/

2. 자동으로 Notion 데이터 로드

3. Notion에서 수정 후 새로고침 → 최신 데이터 반영

---

## 🛠️ API 엔드포인트

### **1. KPIs 가져오기**
```
GET https://your-project.vercel.app/api/notion?type=kpis
```

### **2. Projects 가져오기**
```
GET https://your-project.vercel.app/api/notion?type=projects
```

### **3. 모든 데이터 가져오기**
```
GET https://your-project.vercel.app/api/notion?type=all
```

---

## 💰 비용

- ✅ **GitHub Pages:** 무료
- ✅ **Vercel:** 무료 (월 100GB 대역폭)
- ✅ **Notion API:** 무료

**총 비용: $0**

---

## 🔄 워크플로우

```
1. Notion에서 데이터 수정 (모바일/PC)
   ↓
2. 대시보드에서 새로고침
   ↓
3. Vercel API가 Notion에서 최신 데이터 가져옴
   ↓
4. 최신 데이터 화면에 표시
```

---

## 🐛 문제 해결

### **Q1: "API 연결 실패" 오류**
**A:** 
1. Vercel 환경 변수 확인
2. `NOTION_TOKEN`, `KPIS_DB_ID`, `PROJECTS_DB_ID` 올바르게 설정되었는지 확인
3. Vercel 프로젝트 재배포

### **Q2: "데이터 로드 실패" 오류**
**A:**
1. Notion Integration이 KPIs, Projects 데이터베이스에 연결되었는지 확인
2. Database ID가 올바른지 확인
3. F12 → Console에서 에러 메시지 확인

### **Q3: CORS 오류**
**A:**
- Vercel Function에서 CORS 헤더를 이미 설정했으므로 발생하지 않아야 함
- 만약 발생하면 `api/notion.js`의 CORS 헤더 확인

---

## 📞 지원

문제가 발생하면:
1. F12 → Console 에러 메시지 캡처
2. Vercel Logs 확인
3. 스크린샷과 함께 문의

---

## 🎉 완료!

이제 완전히 안전하고 실시간 동기화되는 대시보드가 완성되었습니다!

✅ Token 안전
✅ 실시간 동기화
✅ 모바일/PC 접근
✅ 팀원 공유
✅ 무료!
