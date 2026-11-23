import { ProjectMember, ProjectPosition } from '../types';

export const POSITIONS: { id: ProjectPosition; label: string; color: string }[] = [
  { id: 'BACKEND', label: '백엔드', color: '#2563EB' },
  { id: 'FRONTEND', label: '프론트엔드', color: '#059669' },
  { id: 'FULLSTACK', label: '풀스택', color: '#0891B2' },
  { id: 'DESIGN', label: '디자인', color: '#DB2777' },
  { id: 'PM', label: 'PM', color: '#D97706' },
  { id: 'INFRA', label: '인프라', color: '#7C3AED' },
  { id: 'ETC', label: '기타', color: '#6B7280' },
];

// Backend "part" values (POST /api/projects, /api/projects/issue-drafts, member responses)
const PART_BY_POSITION: Record<ProjectPosition, string> = {
  BACKEND: 'backend',
  FRONTEND: 'frontend',
  FULLSTACK: 'fullstack',
  DESIGN: 'design',
  PM: 'pm',
  INFRA: 'infra',
  ETC: 'others',
};
export const positionToPart = (p: ProjectPosition) => PART_BY_POSITION[p];
export const partToPosition = (part: string | null | undefined): ProjectPosition | undefined => {
  const key = (part || '').trim().toLowerCase();
  if (key === 'ai') return 'ETC'; // seen in sample data; not an accepted part on create
  return (Object.keys(PART_BY_POSITION) as ProjectPosition[]).find((p) => PART_BY_POSITION[p] === key);
};

/** Suggested tech stack per position. Anything else can be typed in. */
export const SKILLS_BY_POSITION: Record<ProjectPosition, string[]> = {
  BACKEND: [
    'Spring',
    'Spring Boot',
    'Java',
    'Kotlin',
    'Python',
    'FastAPI',
    'Django',
    'Node.js',
    'Express',
    'NestJS',
    'MySQL',
    'PostgreSQL',
    'MongoDB',
    'Redis',
    'Firebase',
    'AWS',
    'Docker',
  ],
  FRONTEND: [
    'HTML/CSS',
    'JavaScript',
    'TypeScript',
    'React',
    'Next.js',
    'Vue',
    'Svelte',
    'Tailwind CSS',
    'React Native',
    'Expo',
    'Flutter',
    'Swift',
    'Electron',
  ],
  FULLSTACK: [
    'TypeScript',
    'React',
    'Next.js',
    'Node.js',
    'NestJS',
    'Spring Boot',
    'Java',
    'Python',
    'FastAPI',
    'MySQL',
    'PostgreSQL',
    'Firebase',
    'Supabase',
  ],
  INFRA: ['AWS', 'GCP', 'Docker', 'Kubernetes', 'GitHub Actions', 'Nginx', 'Linux', 'Terraform', 'Vercel'],
  DESIGN: ['Figma', 'Adobe XD', 'Photoshop', 'Illustrator', 'After Effects', 'Protopie', 'Blender'],
  PM: ['Notion', 'Jira', 'Slack', 'Confluence', 'Miro', 'Google Workspace', 'GitHub Projects'],
  ETC: ['Python', 'pandas', 'scikit-learn', 'LightGBM', 'PyTorch', 'TensorFlow', 'Jupyter', 'Unity', 'Arduino'],
};

export const SKILL_MAX_LENGTH = 30;
export const SKILLS_MAX = 20;

export const positionLabel = (p?: ProjectPosition) => POSITIONS.find((x) => x.id === p)?.label;
export const positionColor = (p?: ProjectPosition) => POSITIONS.find((x) => x.id === p)?.color ?? '#6B7280';

/** Trim, cap length, drop duplicates case-insensitively (keeps the first spelling). */
export function normalizeSkills(skills: string[], max = SKILLS_MAX): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const s = raw.trim().slice(0, SKILL_MAX_LENGTH);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export type PicksByPosition = Partial<Record<ProjectPosition, string[]>>;

/**
 * Skills belong to a position. Switching saves the current position's picks and restores the next
 * position's own picks (empty the first time), so nothing chosen for 프론트엔드 follows you to 백엔드.
 * Picking no position clears the skills.
 */
export function switchPosition(
  memo: PicksByPosition,
  current: ProjectPosition | undefined,
  currentSkills: string[],
  next: ProjectPosition | undefined
): { memo: PicksByPosition; skills: string[] } {
  const saved = current ? { ...memo, [current]: currentSkills } : { ...memo };
  return { memo: saved, skills: next ? saved[next] ?? [] : [] };
}

/** Project tech stack = everything members picked, plus extra entries typed for the project. */
export function projectTechStack(members: ProjectMember[], extra: string[] = []): string[] {
  return normalizeSkills([...members.flatMap((m) => m.skills || []), ...extra], 40);
}
