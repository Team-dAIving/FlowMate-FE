# FlowMate (Frontend) - 학생 팀 프로젝트 관리

FlowMate는 해커톤, 공모전, 경진대회, 캡스톤처럼 여러 팀에서 동시에 프로젝트를 진행하는 학생을 위한 개인 프로젝트 관리 데스크톱 앱입니다. 팀마다 다른 팀원, 업무, 일정, 회의록을 한곳에서 관리합니다.

---

## 🚀 빠른 시작 가이드 (Getting Started)

### 1. 패키지 설치
```bash
npm install
```

### 2. 웹 브라우저 개발 모드 실행 (Vite Dev Server)
```bash
npm run dev
# http://localhost:5173 접속
```

### 3. 데스크톱 앱 실행 (Electron + Vite)
```bash
npm run electron:dev
```

### 4. 프로덕션 빌드 (TypeScript & Vite)
```bash
npm run build
```

---

## 🛠 기술 스택 (Tech Stack)

- **Desktop Runtime**: Electron 34
- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite 6
- **UI Framework & Styling**: Tailwind CSS + shadcn/ui Design Tokens
- **Design Concept**: Minimal Developer Workspace (Linear, GitHub, Raycast, VS Code 스타일)
- **State Management**: Zustand 5
- **Server State**: TanStack Query (React Query)
- **Data Visualization**: Recharts (Donut, Bar, Area Trend)
- **Icons**: Lucide React
- **Typography**: Pretendard (UI), JetBrains Mono (Issue ID, Code, Time)

---

## 💡 핵심 구현 기능 (Key Features)

### 1. 개인 대시보드
- 참여 중인 모든 팀의 내 할 일을 한 화면에 (`안녕하세요, ○○님!`)
- **MY WORK 통계 카드**: Active Tasks, Completed, Overdue
- **MY TASKS 목록**: 프로젝트별로 나뉜 내 업무, 우선순위, 상태 배지, GitHub Issue 연동 상태
- **UPCOMING DEADLINES**: 여러 팀에 걸친 내 업무 마감을 가까운 순으로 D-day와 팀 이름과 함께 표시
- **프로젝트 요약**: 진척도, 소속 팀, 리더, IDE(VS Code / IntelliJ) 바로 열기

### 2. 팀 관리
- 해커톤, 공모전, 경진대회, 수업(캡스톤), 동아리처럼 **활동마다 팀을 따로** 만듭니다. 한 사람이 구성원이 서로 다른 여러 팀에 동시에 속할 수 있습니다.
- **팀 생성 모달 (`Create Team`)**: 팀 이름, 팀 소개(어떤 대회·활동인지), 테마 색상(프리셋 또는 직접 선택). 유저 코드로 팀원 초대, 본인 포함 2명 이상
- **팀 상세 화면 (`TeamDetail`)**: 팀원 목록, 팀 프로젝트와 진척도, 팀원들에게 할당된 업무 현황
- 리더는 팀이 아니라 **프로젝트마다** 지정합니다.

### 3. 프로젝트 관리 및 대시보드 통합
- 프로젝트 생성 템플릿 (주제, 목표, 기술 스택, 일정, GitHub Repo)
- **프로젝트 상세 페이지에 기여도/메트릭 대시보드 완벽 통합!**:
  - **Overview & Dashboard 탭**:
    - 해당 프로젝트의 목표, 설명 및 **담당 참여 팀(Connected Teams)** 배지
    - 해당 프로젝트 전용 **이슈 상태 분포 도넛 차트 (Donut Chart)**
    - 해당 프로젝트 **참여 팀원들의 기여도/업무량 막대 차트 (Workload Bar Chart)**
    - 해당 프로젝트 **주간 완료 속도 추이 (Velocity Area Chart)**
  - **Issues**: 이슈 목록 필터링
  - **Board**: 상태별 칸반 보드
  - **Timeline**: 간트차트형 일정 뷰
  - **Meetings**: 연결된 회의록
  - **Members**: 참여 팀원 및 권한

### 4. 업무 관리 (All Issues: 프로젝트별로 나뉨)
- **3가지 뷰 모드**:
  - **List View**: Linear 스타일 고밀도 테이블
  - **Kanban Board**: Drag & Drop 및 상태 이동 (TODO / IN_PROGRESS / IN_REVIEW / DONE)
  - **Timeline View**: 날짜별 일정 간트 차트
- **업무 상세 및 수정 모달**:
  - 담당자, 우선순위, 마감일, 소요 시간
  - **GitHub Issue 단방향 생성 및 연동**: 버튼 클릭 시 GitHub Issue 자동 생성 및 번호/URL 연결
  - 활동 내역 및 실시간 댓글 스레드

### 5. 회의록 관리 및 AI 업무 추출/승인 (핵심 차별화 기능)
- **회의 녹음 모달 (MediaRecorder API)**:
  - Web Audio API 기반 **실시간 오디오 파형(Waveform Canvas)** 시각화
  - 녹음 타이머 및 일시정지/재개
  - "녹음 완료 및 AI 분석" 원클릭 파이프라인
- **AI 회의록 상세**:
  - **AI Summary**: Bedrock 기반 회의 전체 요약
  - **Decisions**: 주요 결정 사항 도출
  - **Transcript**: Amazon Transcribe STT 전문 (타임스탬프 + 발화자 라벨)
  - **Action Items 검토 및 수동 승인 화면**:
    - AI가 추출한 각 업무의 제목, 내용, 담당자, 마감일, 우선순위 수정
    - 원본 Transcript 구간 인용 (source quote)
    - **승인(Approve) 시 FlowMate 업무 등록 + GitHub Issue 자동 생성**

### 6. 데스크톱 네이티브 기능
- **Command Palette (`Ctrl + K` / `Cmd + K`)**:
  - 어디서든 새 업무 생성(`C`), 회의 녹음 시작, 대시보드 이동, 테마 전환 등 즉시 실행
- **시스템 타이틀바**:
  - 커스텀 데스크톱 프레임, 최소화/최대화/닫기 IPC 제어
  - 검색 트리거, 테마 토글, 알림 센터
- **라이트/다크 테마 (Light/Dark Mode)**:
  - Light (#F7F8FA, #FFFFFF, Primary #4F46E5)
  - Dark (#0D1117, #161B22, #21262D, Primary #58A6FF)
- **알림 센터 (Notification Panel)**:
  - Electron OS 네이티브 알림 연동 및 인-앱 알림 패널

---

## 📁 디렉터리 구조

```text
src/
├── types/                 # 도메인 모델 (User, Project, Task, Meeting, ActionItem, Electron)
├── store/                 # Zustand 상태 관리 (Workspace, Task, Meeting, UI)
├── services/              # API 통신 계층, Mock Data, GitHub Issue 연동
├── hooks/                 # Web Audio API 녹음기, 단축키 훅
├── utils/                 # cn(tailwind-merge), 날짜/시간 포맷터
├── components/
│   ├── ui/                # Button, Input, Modal, Badge, Card, Avatar, Tabs, Progress
│   ├── layout/            # TitleBar (Desktop Header), Sidebar, AppLayout
│   ├── dashboard/         # PersonalDashboard (Good evening, Developer.)
│   ├── team/              # TeamDashboard (Recharts Donut, Bar, Area charts)
│   ├── projects/          # ProjectList, ProjectDetail (6개 탭), ProjectCreateModal
│   ├── tasks/             # TasksView, TaskListView, TaskKanbanView, TaskTimelineView, TaskDetailModal, TaskCreateModal
│   ├── meetings/          # MeetingList, MeetingDetail, AudioRecorderModal, WaveformVisualizer
│   ├── command-palette/   # Raycast/Linear 스타일 Ctrl+K CommandPalette
│   └── notifications/     # NotificationPanel
├── electron/
│   ├── main.cjs           # Electron 메인 프로세스 (Lifecycle, Tray, Shortcuts, IPC)
│   └── preload.cjs        # Context Isolation 기반 안전한 IPC API
├── App.tsx
├── main.tsx
└── index.css
```
