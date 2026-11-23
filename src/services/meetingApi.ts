import type {
  ActionItem,
  ApprovalStatus,
  Meeting,
  MeetingStatus,
  TaskPriority,
  User,
  UserRole,
} from '../types';
import { ApiError, http } from './http';

const SUPPORTED_RECORDING_TYPES = new Set([
  'audio/webm',
  'video/webm',
  'audio/mp4',
  'video/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
]);

interface MeetingSummaryDto {
  meetingId: number;
  projectId: number;
  title: string;
  heldAt: string | null;
  durationSeconds?: number | null;
  processingStatus: string;
  failureReason?: string | null;
  transcriptionJobId?: string | null;
}

interface ParticipantDto {
  userId: number;
  nickname: string | null;
  avatarUrl: string | null;
  role: string | null;
  parts: string[] | null;
}

interface TranscriptSegmentDto {
  segmentId: string;
  speakerId: string | number | null;
  startMs: number;
  endMs: number;
  timestamp: string;
  text: string;
}

interface SuggestedTaskDto {
  suggestionId: number;
  proposedData: {
    title?: string | null;
    description?: string | null;
    assigneeId?: number | null;
    dueDate?: string | null;
  } | null;
  priority: string | null;
  assignee: ParticipantDto | null;
  evidenceSegments: TranscriptSegmentDto[] | null;
  reviewStatus: string | null;
  createdAt: string | null;
}

interface MeetingDetailDto extends MeetingSummaryDto {
  participants: ParticipantDto[] | null;
  transcript: {
    language: string;
    fullText: string;
    segments: TranscriptSegmentDto[] | null;
  } | null;
  analysis: {
    summary: string;
    topics: string[] | null;
    decisions: Array<{ content: string; evidenceSegmentIds: string[] | null }> | null;
    unresolvedItems: string[] | null;
  } | null;
  taskSuggestions: SuggestedTaskDto[] | null;
}

interface RecordingUploadDto {
  meetingId: number;
  objectKey: string;
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  expiresAt: string;
}

const toStatus = (value: string | null | undefined): MeetingStatus => {
  const status = (value || '').trim().toUpperCase();
  if (['COMPLETED', 'ANALYZED', 'DONE', 'SUCCESS'].includes(status)) return 'ANALYZED';
  if (status.includes('FAILED') || status === 'ERROR') return 'FAILED';
  if (status === 'RECORDING') return 'RECORDING';
  if (['RECORDED', 'UPLOADED', 'PENDING'].includes(status)) return 'RECORDED';
  return 'TRANSCRIBING';
};

const toUserRole = (value: string | null): UserRole => {
  const role = (value || '').toUpperCase();
  return role === 'OWNER' || role === 'ADMIN' || role === 'VIEWER' ? role : 'MEMBER';
};

const toParticipant = (participant: ParticipantDto): User => ({
  id: String(participant.userId),
  name: participant.nickname || '이름 없음',
  email: '',
  avatarUrl: participant.avatarUrl || undefined,
  role: toUserRole(participant.role),
  department: participant.parts?.join(', ') || undefined,
});

const toPriority = (value: string | null): TaskPriority => {
  const priority = (value || '').toUpperCase();
  return priority === 'LOW' || priority === 'HIGH' || priority === 'URGENT' ? priority : 'MEDIUM';
};

const toApprovalStatus = (value: string | null): ApprovalStatus => {
  const status = (value || '').toUpperCase();
  return status === 'APPROVED' || status === 'REJECTED' ? status : 'PENDING';
};

const toActionItem = (suggestion: SuggestedTaskDto, meetingId: string): ActionItem => ({
  id: String(suggestion.suggestionId),
  meetingId,
  title: suggestion.proposedData?.title || '제목 없는 업무 제안',
  description: suggestion.proposedData?.description || '',
  assigneeId:
    suggestion.proposedData?.assigneeId != null
      ? String(suggestion.proposedData.assigneeId)
      : suggestion.assignee
        ? String(suggestion.assignee.userId)
        : undefined,
  assigneeName: suggestion.assignee?.nickname || undefined,
  dueDate: suggestion.proposedData?.dueDate || undefined,
  priority: toPriority(suggestion.priority),
  approvalStatus: toApprovalStatus(suggestion.reviewStatus),
  syncStatus: 'NONE',
  sourceQuote:
    suggestion.evidenceSegments?.map((segment) => `${segment.timestamp} ${segment.text}`).join('\n') || undefined,
});

const baseMeeting = (dto: MeetingSummaryDto, projectName?: string): Meeting => ({
  id: String(dto.meetingId),
  projectId: String(dto.projectId),
  projectName,
  title: dto.title || '(제목 없는 회의)',
  meetingDate: dto.heldAt || '',
  participants: [],
  audioDurationSeconds: dto.durationSeconds ?? undefined,
  status: toStatus(dto.processingStatus),
  failureReason: dto.failureReason || undefined,
  transcriptionJobId: dto.transcriptionJobId || undefined,
  actionItems: [],
  transcript: [],
  decisions: [],
  createdAt: dto.heldAt || '',
});

const toMeetingDetail = (dto: MeetingDetailDto, projectName?: string): Meeting => {
  const participants = (dto.participants || []).map(toParticipant);
  const participantNames = new Map(participants.map((participant) => [participant.id, participant.name]));
  const meeting = baseMeeting(dto, projectName);
  return {
    ...meeting,
    participants,
    summary: dto.analysis?.summary || undefined,
    decisions: (dto.analysis?.decisions || []).map((decision) => decision.content),
    transcript: (dto.transcript?.segments || []).map((segment) => ({
      id: segment.segmentId,
      speaker: segment.speakerId == null ? '화자' : participantNames.get(String(segment.speakerId)) || `화자 ${segment.speakerId}`,
      timestamp: segment.timestamp,
      text: segment.text,
    })),
    actionItems: (dto.taskSuggestions || []).map((suggestion) => toActionItem(suggestion, meeting.id)),
  };
};

function recordingContentType(blob: Blob): string {
  const contentType = blob.type.split(';', 1)[0].trim().toLowerCase();
  if (!SUPPORTED_RECORDING_TYPES.has(contentType)) {
    throw new ApiError(400, `지원하지 않는 녹음 형식입니다: ${contentType || '알 수 없음'}`);
  }
  return contentType;
}

async function putRecording(upload: RecordingUploadDto, blob: Blob): Promise<void> {
  if ((upload.method || '').toUpperCase() !== 'PUT') {
    throw new ApiError(502, '서버가 올바르지 않은 녹음 업로드 방식을 반환했습니다.');
  }
  const timeout = AbortSignal.timeout(5 * 60 * 1000);
  let response: Response;
  try {
    response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: upload.headers,
      body: blob,
      signal: timeout,
    });
  } catch (error) {
    throw new ApiError(
      0,
      timeout.aborted
        ? '녹음 파일 업로드 시간이 초과되었습니다. 다시 시도해주세요.'
        : '녹음 파일을 업로드하지 못했습니다. 네트워크 또는 S3 CORS 설정을 확인해주세요.',
      error
    );
  }
  if (!response.ok) {
    throw new ApiError(response.status, `녹음 파일 업로드에 실패했습니다. (HTTP ${response.status})`);
  }
}

export const meetingApi = {
  create: async (projectId: string, title: string, projectName?: string): Promise<Meeting> => {
    const numericProjectId = Number(projectId);
    if (!Number.isSafeInteger(numericProjectId) || numericProjectId <= 0) {
      throw new ApiError(400, '올바른 프로젝트를 선택해주세요.');
    }
    const dto = await http<MeetingSummaryDto>('/api/meetings', {
      method: 'POST',
      json: { projectId: numericProjectId, title },
    });
    return baseMeeting(dto, projectName);
  },

  getById: async (meetingId: string, projectName?: string): Promise<Meeting> => {
    const dto = await http<MeetingDetailDto>(`/api/meetings/${encodeURIComponent(meetingId)}`);
    return toMeetingDetail(dto, projectName);
  },

  uploadAndComplete: async (meetingId: string, blob: Blob, durationSeconds: number): Promise<Meeting> => {
    if (blob.size === 0) throw new ApiError(400, '녹음된 음성이 없습니다. 다시 녹음해주세요.');
    const contentType = recordingContentType(blob);
    const upload = await http<RecordingUploadDto>(
      `/api/meetings/${encodeURIComponent(meetingId)}/recording-upload`,
      { method: 'POST', json: { contentType } }
    );
    await putRecording(upload, blob);
    const dto = await http<MeetingDetailDto>(
      `/api/meetings/${encodeURIComponent(meetingId)}/recording-upload/complete`,
      {
        method: 'POST',
        json: { durationSeconds: Math.max(1, Math.round(durationSeconds)) },
        timeoutMs: 60_000,
      }
    );
    return toMeetingDetail(dto);
  },
};
