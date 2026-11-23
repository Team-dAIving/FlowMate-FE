import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, Sparkles, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { formatDuration } from '../../utils/formatters';
import { isFeatureAvailable } from '../../services/features';

export interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({ isOpen, onClose }) => {
  const { createMeeting, completeMeetingRecording } = useMeetingStore();
  const { projects, currentProjectId, setCurrentView } = useWorkspaceStore();

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(currentProjectId || projects[0]?.id || '');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const [notice, setNotice] = useState(''); // e.g. no microphone -> demo mode
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const createdMeetingIdRef = useRef<string | null>(null);

  // The modal stays mounted: start every recording clean, in the project the user is looking at
  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setDuration(0);
    setIsPaused(false);
    setIsStarting(false);
    setRecordedBlob(null);
    setNotice('');
    setError('');
    chunksRef.current = [];
    createdMeetingIdRef.current = null;
    setProjectId(projects.some((p) => p.id === currentProjectId) ? currentProjectId! : projects[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  // Start Mic Recording
  const startRecording = async () => {
    // Every recording starts at 00:00 (after a failed save the old duration used to keep counting)
    setDuration(0);
    setError('');
    setNotice('');
    if (!projectId) {
      setError('회의를 생성할 프로젝트를 선택해주세요.');
      return;
    }
    const meetingTitle = title.trim() || `팀 회의 (${new Date().toLocaleDateString()})`;
    if (meetingTitle.length > 200) {
      setError('회의 제목은 200자 이하여야 합니다.');
      return;
    }
    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const supportedType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      if (!supportedType) {
        throw new Error('이 환경에서 서버가 지원하는 녹음 형식을 만들 수 없습니다.');
      }
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      const meeting = await createMeeting({
        projectId,
        projectName: projects.find((project) => project.id === projectId)?.name,
        title: meetingTitle,
      });
      createdMeetingIdRef.current = meeting.id;
      setTitle(meetingTitle);
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      console.error(err);
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      mediaRecorderRef.current = null;
      setError(err instanceof Error && err.message ? err.message : '회의 녹음을 시작하지 못했습니다.');
    } finally {
      setIsStarting(false);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    setIsPaused(true);
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    setIsPaused(false);
  };

  const uploadAndRequestAnalysis = async (recording: Blob) => {
    const meetingId = createdMeetingIdRef.current;
    if (!meetingId) {
      setError('생성된 회의 정보를 찾을 수 없습니다.');
      return;
    }
    setIsProcessingAI(true);
    setError('');
    try {
      await completeMeetingRecording(meetingId, recording, duration);
      setRecordedBlob(null);
      onClose();
      setCurrentView('meeting-detail', meetingId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : '녹음 업로드 또는 STT 요청에 실패했습니다.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const stopAndAnalyze = async () => {
    const recorder = mediaRecorderRef.current;
    try {
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve, reject) => {
          recorder.addEventListener('stop', () => resolve(), { once: true });
          recorder.addEventListener('error', () => reject(new Error('녹음 파일 생성에 실패했습니다.')), {
            once: true,
          });
          recorder.stop();
        });
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '녹음을 종료하지 못했습니다.');
      return;
    } finally {
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }

    const contentType = recorder?.mimeType.split(';', 1)[0] || 'audio/webm';
    const recording = new Blob(chunksRef.current, { type: contentType });
    setRecordedBlob(recording);
    await uploadAndRequestAnalysis(recording);
  };

  const handleClose = () => {
    // Saving/analysis in progress: closing now would yank the user to the meeting later from elsewhere
    if (isProcessingAI || isStarting) return;
    if (isRecording) {
      if (!window.confirm('녹음이 진행 중입니다. 정말 중단하고 닫으시겠습니까?')) {
        return;
      }
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    audioStreamRef.current = null;
    setIsRecording(false);
    setDuration(0);
    onClose();
  };

  if (!isFeatureAvailable('meetingWrite')) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="md"
      title={
        <div className="flex items-center gap-2 text-text-primary">
          <Mic className="h-4 w-4 text-red-500 animate-pulse" />
          <span>팀 회의 녹음 & AI 분석</span>
        </div>
      }
      description="회의 음성을 녹음하여 Amazon Transcribe STT 및 Bedrock AI 요약, Action Item을 추출합니다."
    >
      <div className="space-y-4">
        {/* Project & Title Input */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              연결할 프로젝트
            </label>
            <select
              value={projectId}
              disabled={isRecording || isStarting || isProcessingAI || recordedBlob !== null}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="회의 제목 (Meeting Title)"
            placeholder="예: 해커톤 1일차 중간 점검"
            value={title}
            disabled={isRecording || isStarting || isProcessingAI || recordedBlob !== null}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Live Audio Visualizer Canvas */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-text-secondary">음성 신호 (Microphone Input)</span>
            <span className="font-mono text-sm font-bold text-red-500">
              {formatDuration(duration)}
            </span>
          </div>

          <WaveformVisualizer
            stream={audioStreamRef.current}
            isRecording={isRecording && !isPaused}
          />
        </div>

        {notice && <p className="text-[11px] text-amber-600">{notice}</p>}
        {error && (
          <p role="alert" className="text-[11px] text-red-500">
            {error}
          </p>
        )}

        {/* Recording Controls */}
        <div className="p-4 rounded-lg border border-border bg-surface-hover/50 flex flex-col items-center justify-center space-y-3">
          {!isRecording && !isProcessingAI && !recordedBlob && (
            <Button
              type="button"
              variant="danger"
              size="lg"
              onClick={startRecording}
              isLoading={isStarting}
              disabled={isStarting || !projectId}
              className="w-full h-10 gap-2"
            >
              <Mic className="h-4 w-4" />
              <span>회의 녹음 시작</span>
            </Button>
          )}

          {!isRecording && !isProcessingAI && recordedBlob && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => uploadAndRequestAnalysis(recordedBlob)}
              className="w-full h-10 gap-2"
            >
              <Upload className="h-4 w-4" />
              <span>녹음 업로드 다시 시도</span>
            </Button>
          )}

          {isRecording && (
            <div className="flex items-center gap-3 w-full">
              {isPaused ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resumeRecording}
                  className="flex-1 h-9 gap-1.5"
                >
                  <Play className="h-4 w-4 text-emerald-500" />
                  <span>녹음 재개</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={pauseRecording}
                  className="flex-1 h-9 gap-1.5"
                >
                  <Pause className="h-4 w-4 text-amber-500" />
                  <span>일시정지</span>
                </Button>
              )}

              <Button
                type="button"
                variant="primary"
                onClick={stopAndAnalyze}
                disabled={duration < 1}
                className="flex-1 h-9 gap-1.5 bg-primary"
              >
                <Square className="h-3.5 w-3.5" />
                <span>녹음 완료 및 AI 분석</span>
              </Button>
            </div>
          )}

          {isProcessingAI && (
            <div className="text-center py-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-primary font-semibold text-xs">
                <Sparkles className="h-4 w-4 animate-spin" />
                <span>녹음 업로드 및 STT 요청 중...</span>
              </div>
              <p className="text-[11px] text-text-muted">
                녹음 파일을 업로드하고 서버에 STT 분석을 요청하고 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-text-muted text-center leading-relaxed">
          * AI가 추출한 Action Items는 즉시 등록되지 않으며, 사용자 검토 및 승인을 거쳐 생성됩니다.
        </div>
      </div>
    </Modal>
  );
};
