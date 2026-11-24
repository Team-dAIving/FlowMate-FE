# FlowMate (Frontend)

FlowMate는 해커톤, 공모전, 경진대회, 캡스톤처럼 여러 팀에서 동시에 프로젝트를 진행하는 학생을 위한 프로젝트 관리 앱입니다. 팀마다 다른 팀원, 업무, 일정, 회의록을 한곳에서 관리하고, GitHub 저장소와 이슈를 연결합니다.

웹(Vercel 배포)과 데스크톱(Electron) 두 가지로 실행됩니다. 백엔드는 FlowMate-BE입니다.

---

## 빠른 시작

```bash
npm install

npm run dev             # 웹 개발 서버 (http://localhost:5173)
npm run electron:dev    # 데스크톱 앱 (Vite + Electron)
npm run build           # 타입 검사 + 웹 프로덕션 빌드 (dist/)
npm run electron:build  # 데스크톱 설치 파일 (release/, Windows nsis / macOS dmg / Linux AppImage)
```

### 환경 변수

| 이름 | 설명 |
| --- | --- |
| `VITE_API_BASE_URL` | 백엔드 주소. 예: `https://flowmate.observer-v.cloud` |

- `VITE_API_BASE_URL`을 비워 두면 **목업 모드**입니다. 로그인 없이 `src/services/mockData.ts`의 데이터로 모든 화면이 동작하고, 변경 사항은 브라우저 `localStorage`에 저장됩니다.
- 값을 넣으면 **실서버 모드**입니다. GitHub 로그인이 필요하고, 백엔드 API가 있는 기능만 켜집니다(아래 [기능별 지원 현황](#기능별-지원-현황) 참고).
- 로컬은 `.env.local`, Vercel은 Project Settings → Environment Variables에 넣습니다. `.env.example`을 참고하세요.

---

## 주요 기능

### 로그인과 계정
- GitHub OAuth 로그인. 웹은 `/oauth/callback`, 데스크톱은 `flowmate://oauth/callback` 딥링크로 돌아옵니다.
- 처음 로그인하면 닉네임을 설정합니다. 마이페이지에서 닉네임과 내 유저 코드를 확인·수정합니다.
- 토큰 보관: 웹은 탭 단위 `sessionStorage`, 데스크톱은 Electron 메인 프로세스(`electron/auth.cjs`)가 보관하고 렌더러에는 노출하지 않습니다.

### 개인 대시보드
- 참여 중인 모든 프로젝트의 내 업무: 진행 중·완료·지연 통계, 프로젝트별 내 업무 목록, 마감 임박 업무(D-day)
- 프로젝트 요약: 진척도, 소속 팀, 리더, IDE 바로 열기(VS Code, IntelliJ)

### 팀
- 활동마다 팀을 만듭니다. 팀 이름, 소개, 테마 색상을 정하고 유저 코드로 팀원을 초대합니다(본인 포함 2명 이상).
- 팀 상세: 팀원, 팀 프로젝트와 진척도, 팀원별 업무 현황

### 프로젝트
- **프로젝트 생성**
  - 이름, 설명, 최종 목표, 설계서(AI 업무 생성에 사용), 유형, 기간
  - 소속 팀 선택. 목록의 **"+ 새 팀 만들기"**로 팀을 바로 만들고 선택할 수 있습니다.
  - 멤버별 포지션과 기술 스택, 리더 지정. 멤버는 소속 팀의 팀원 중에서 고르고, 일부는 제외할 수 있습니다.
  - **GitHub 연결**: 선택한 팀에 설치된 GitHub 앱의 Organization을 불러옵니다. 팀을 바꿀 때마다 다시 조회합니다. 설치된 곳이 없으면 GitHub 앱 설치 버튼이 나옵니다. 저장소는 공통/백엔드/프론트엔드/AI 역할로 여러 개 연결합니다(공통은 1개까지).
- **프로젝트 상세**: 진척도, 업무 상태 분포(도넛 차트), 멤버별 업무량(막대 차트), 최근 7일 완료 추이, 업무 목록·보드·타임라인, 회의, 멤버
- **AI 이슈 자동 생성**: 설계서와 팀 구성을 바탕으로 AI가 업무 초안을 만듭니다. 제목, 설명, 담당자, 기간, 우선순위, 예상 시간을 고친 뒤 일괄 등록합니다. 업무마다 GitHub 이슈 생성 여부와 **이슈를 만들 저장소**를 고를 수 있습니다(기본값은 담당자 파트의 저장소).

### GitHub 앱 설치 흐름
1. 프로젝트 생성 모달에서 설치 버튼을 누르면 `POST /api/github/installations/start`를 호출하고, 선택한 팀을 `sessionStorage`에 저장합니다.
2. GitHub에서 설치를 마치면 `/github/install/callback?installation_id=..&state=..`로 돌아옵니다.
3. 콜백 화면이 `POST /api/github/installations/complete`를 호출해 설치 정보를 저장합니다.
4. 성공하면 저장해 둔 팀으로 프로젝트 생성 모달을 다시 열고 설치 목록을 다시 불러옵니다.

웹은 같은 탭에서 이동합니다(로그인 토큰과 팀 정보가 탭의 `sessionStorage`에 있기 때문). 따라서 설치하러 가기 전에 입력한 폼 내용은 남지 않습니다. 데스크톱은 시스템 브라우저에서 설치한 뒤 콜백 페이지가 `flowmate://github/install/callback` 딥링크로 앱에 값을 넘기고, 앱이 complete를 호출합니다.

### 업무
- 보기: 리스트, 칸반 보드(드래그로 상태 이동), 타임라인
- 업무 직접 등록: 프로젝트, 담당자(프로젝트 멤버), 우선순위, 마감일, 예상 시간. GitHub 이슈를 함께 만들 수 있고, 이슈를 만들 저장소를 고릅니다.
- 업무 상세: 담당자, 우선순위, 마감일, 댓글, 삭제, 연결된 GitHub 이슈 링크

### 회의
- 회의 녹음: 실시간 파형 표시, 일시정지/재개, 타이머. 녹음 파일은 서버가 발급한 업로드 URL(S3)로 직접 올리고, 업로드 완료를 알리면 서버가 STT와 AI 분석을 진행합니다.
- 회의 상세: 요약, 결정 사항, 발화자·타임스탬프가 붙은 전문
- **AI 업무 제안 검토**: 회의에서 추출된 업무(새 업무 또는 기존 업무 수정)의 제목, 설명, 담당자, 마감일, 우선순위를 고친 뒤 승인하거나 거절합니다. 근거가 된 발화가 인용으로 함께 표시됩니다. 승인할 때 GitHub 이슈를 함께 만들 수 있습니다.

### 데스크톱 기능
- Command Palette(`Ctrl/Cmd + K`): 새 업무, 회의 녹음, 화면 이동, 테마 전환
- 커스텀 타이틀바(최소화/최대화/닫기), 라이트/다크 테마
- OS 알림(목업 모드의 알림 패널), IDE 실행(VS Code는 `vscode://`, IntelliJ는 데스크톱에서 직접 실행)

---

## 기능별 지원 현황

실서버 모드에서는 `src/services/features.ts`의 플래그로 기능을 켜고 끕니다. 목업 모드에서는 모든 기능이 켜집니다. 백엔드에 API가 생기면 플래그를 `true`로 바꾸고 `src/services/api.ts`에 연결합니다.

| 실서버에서 동작 | 실서버에서 꺼짐 (API 없음) |
| --- | --- |
| 로그인, 내 정보, 닉네임, 로그아웃 | 프로젝트 생성 후 수정(정보, 멤버, 역할, 저장소, 리더) |
| 팀 목록·생성·상세, 유저 코드 조회 | 기존 업무의 상태·우선순위·담당자·날짜 변경 (칸반 드래그 포함) |
| 프로젝트 목록·상세·업무·회의·멤버·저장소 | 업무 상세에서 GitHub 이슈 따로 만들기 |
| 프로젝트 생성, GitHub 앱 설치·조회 | 개인 프로젝트(팀 없음): 서버가 `teamId`를 요구 |
| AI 업무 초안 생성·일괄 등록 | 알림 |
| 업무 직접 등록(+ GitHub 이슈), 상세, 댓글, 삭제 | |
| 회의 생성, 녹음 업로드, 상세, AI 업무 제안 수정·승인·거절 | |

---

## 사용하는 백엔드 API

| 도메인 | API |
| --- | --- |
| auth | `GET /oauth2/authorization/github`, `POST /api/auth/token`, `GET /api/auth/me`, `PATCH /api/auth/me/nickname`, `POST /api/auth/logout` |
| teams | `GET /api/teams`, `POST /api/teams`, `GET /api/teams/{teamId}`, `GET /api/users/code/{userCode}` |
| projects | `GET /api/projects`, `POST /api/projects`, `GET /api/projects/{projectId}`, `GET /api/projects/{projectId}/tasks`, `GET /api/projects/{projectId}/meetings`, `GET /api/projects/{projectId}/members`, `GET /api/projects/{projectId}/repositories` |
| AI 업무 | `POST /api/projects/issue-drafts`, `POST /api/projects/{projectId}/tasks` (일괄 등록, 업무 1건 직접 등록에도 사용) |
| tasks | `GET /api/tasks`, `GET /api/tasks/{taskId}`, `POST /api/tasks/{taskId}/comments`, `DELETE /api/tasks/{taskId}` |
| GitHub 앱 | `GET /api/github/installations?teamId=`, `POST /api/github/installations/start`, `POST /api/github/installations/complete` |
| meetings | `POST /api/meetings`, `GET /api/meetings/{meetingId}`, `POST /api/meetings/{meetingId}/recording-upload`, `POST /api/meetings/{meetingId}/recording-upload/complete`, `PUT /api/meetings/{meetingId}/task-suggestions/{suggestionId}`, `POST .../approve`, `POST .../reject` |

---

## 배포 (Vercel)

- 저장소를 Vercel에 연결하면 `vercel.json`대로 빌드합니다(`npm run build` → `dist`). 모든 경로를 `index.html`로 보내는 SPA 라우팅과 보안 헤더(CSP 등)가 들어 있습니다.
- `main` 브랜치에 푸시하면 배포됩니다. 현재 배포 주소: https://flow-mate-fe.vercel.app

### 백엔드·외부 서비스에 필요한 설정

| 항목 | 값 |
| --- | --- |
| 웹 로그인 콜백 | `https://<배포 주소>/oauth/callback` |
| 데스크톱 로그인 콜백 | `flowmate://oauth/callback` |
| GitHub 앱 Setup URL | `https://<배포 주소>/github/install/callback` |
| CORS 허용 origin | 배포 주소 (로컬 개발 시 `http://localhost:5173`) |
| 녹음 업로드 S3 버킷 CORS | 배포 주소에서 `PUT` 허용 |

데스크톱 앱은 설치 시 `flowmate://` 프로토콜을 OS에 등록합니다(`package.json`의 `build.protocols`).

---

## 기술 스택

| 구분 | 사용 |
| --- | --- |
| UI | React 18, TypeScript 5.7 |
| 빌드 | Vite 6 |
| 데스크톱 | Electron 45, electron-builder |
| 스타일 | Tailwind CSS 3, clsx, tailwind-merge, class-variance-authority |
| 상태 | Zustand 5, TanStack Query 5 |
| 차트 | Recharts 2 |
| 날짜 | date-fns 4 |
| 아이콘 | Lucide React |

---

## 디렉터리 구조

```text
electron/
├── main.cjs              # Electron 메인 프로세스: 창, 단축키, flowmate:// 딥링크, IPC
├── auth.cjs              # 데스크톱 로그인과 JWT 보관 (API 요청에 토큰 첨부)
└── preload.cjs           # 렌더러에 노출하는 IPC API
src/
├── App.tsx               # /github/install/callback 이면 콜백 화면, 아니면 로그인 확인 후 앱
├── types/                # 도메인 타입, Electron API 타입
├── services/
│   ├── http.ts           # fetch 래퍼, 실서버/목업 모드 판단 (VITE_API_BASE_URL)
│   ├── api.ts            # 화면이 쓰는 API 진입점 (실서버 호출 또는 목업 처리)
│   ├── features.ts       # 실서버에서 켜진 기능 플래그
│   ├── authApi.ts, webAuth.ts                      # 로그인
│   ├── teamApi.ts, projectTaskApi.ts, meetingApi.ts  # 도메인별 API
│   ├── githubApi.ts, githubInstall.ts              # GitHub 앱 설치·조회·콜백
│   └── mockData.ts       # 목업 모드 데이터
├── store/                # Zustand 스토어 (auth, workspace, team, task, meeting, ui)
├── utils/                # 날짜·진척도·업무 상태, GitHub 저장소 역할, 포지션, IDE 실행 등
└── components/
    ├── auth/             # 로그인, 로그인 확인, 닉네임 설정
    ├── layout/           # 타이틀바, 사이드바, 레이아웃
    ├── dashboard/        # 개인 대시보드
    ├── teams/            # 팀 목록·상세·생성
    ├── team/             # 팀 대시보드 차트
    ├── projects/         # 프로젝트 목록·상세·생성, 멤버 역할, AI 이슈 생성, IDE 버튼
    ├── tasks/            # 리스트·칸반·타임라인, 업무 등록·상세
    ├── meetings/         # 회의 목록·상세, 녹음, 파형
    ├── github/           # GitHub 앱 설치 콜백 화면
    ├── mypage/           # 마이페이지
    ├── command-palette/  # Ctrl+K 명령 팔레트
    ├── notifications/    # 알림 패널
    └── ui/               # Button, Input, Modal 등 공통 컴포넌트
```

목업 데이터만으로 동작하던 시점의 코드는 `backup/mock-data` 브랜치에 있습니다.
