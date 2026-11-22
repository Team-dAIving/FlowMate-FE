import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, Sparkles, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { formatDuration } from '../../utils/formatters';
import { todayISO } from '../../utils/dates';
import { isFeatureAvailable } from '../../services/features';
import { NotConnected } from '../ui/NotConnected';

export interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({ isOpen, onClose }) => {
  const { createMeeting, analyzeMeeting } = useMeetingStore();
  const { projects, currentProjectId, setCurrentView } = useWorkspaceStore();

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(currentProjectId || projects[0]?.id || '');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const [notice, setNotice] = useState(''); // e.g. no microphone -> demo mode
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // The modal stays mounted: start every recording clean, in the project the user is looking at
  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setDuration(0);
    setIsPaused(false);
    setNotice('');
    setError('');
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      console.warn('Microphone permission or hardware access issue. Falling back to simulated stream:', err);
      // Simulated recording for dev / browser sandbox — but say so, instead of pretending to record
      setNotice('마이크를 사용할 수 없어 시연용 모드로 진행합니다. 실제 음성은 녹음되지 않습니다.');
      setIsRecording(true);
      setIsPaused(false);
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

  const stopAndAnalyze = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    setIsRecording(false);
    setIsProcessingAI(true);

    setError('');
    let newMeeting;
    try {
      newMeeting = await createMeeting({
        projectId,
        title: title.trim() || `팀 회의 (${new Date().toLocaleDateString()})`,
        meetingDate: todayISO(),
        audioDurationSeconds: duration, // real length (it used to invent 120s for short recordings)
      });
    } catch (err) {
      // Nothing was saved: stay here so the user can try again
      console.error(err);
      setIsProcessingAI(false);
      setError(err instanceof Error && err.message ? err.message : '회의를 저장하지 못했습니다.');
      return;
    }

    // The meeting is saved from here on. If analysis fails, go to it (it can be re-analyzed there)
    // instead of offering a retry here, which would save the same meeting twice.
    let analysisFailed = false;
    try {
      await analyzeMeeting(newMeeting.id);
    } catch (err) {
      console.error(err);
      analysisFailed = true;
    }
    setIsProcessingAI(false);
    onClose();
    setCurrentView('meeting-detail', newMeeting.id);
    if (analysisFailed) {
      window.alert('회의는 저장됐지만 AI 분석에 실패했습니다. 회의 상세에서 다시 분석할 수 있습니다.');
    }
  };

  const handleClose = () => {
    // Saving/analysis in progress: closing now would yank the user to the meeting later from elsewhere
    if (isProcessingAI) return;
    if (isRecording) {
      if (!window.confirm('녹음이 진행 중입니다. 정말 중단하고 닫으시겠습니까?')) {
        return;
      }
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
    setDuration(0);
    onClose();
  };

  // Deployed service without this backend API yet: say so instead of a form that can only fail
  if (!isFeatureAvailable('meetings')) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" title="팀 회의 녹음 & AI 분석">
        <NotConnected feature="회의 녹음·AI 분석" />
      </Modal>
    );
  }

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
              disabled={isRecording || isProcessingAI}
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
            disabled={isRecording || isProcessingAI}
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
          {!isRecording && !isProcessingAI && (
            <Button
              type="button"
              variant="danger"
              size="lg"
              onClick={startRecording}
              className="w-full h-10 gap-2"
            >
              <Mic className="h-4 w-4" />
              <span>회의 녹음 시작</span>
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
                <span>Amazon Bedrock & Transcribe 분석 중...</span>
              </div>
              <p className="text-[11px] text-text-muted">
                회의 음성을 STT 변환하고 주요 안건, 결정 사항, Action Items를 추출하고 있습니다.
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
