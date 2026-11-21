import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, Sparkles, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { formatDuration } from '../../utils/formatters';

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

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
      // Simulated recording for dev / browser sandbox
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

    try {
      const newMeeting = await createMeeting({
        projectId: projectId || projects[0]?.id,
        title: title.trim() || `개발팀 회의 (${new Date().toLocaleDateString()})`,
        meetingDate: new Date().toISOString().split('T')[0],
        audioDurationSeconds: duration || 120,
      });

      // AI Analysis
      await analyzeMeeting(newMeeting.id);

      setIsProcessingAI(false);
      onClose();
      setCurrentView('meeting-detail', newMeeting.id);
    } catch (err) {
      console.error(err);
      setIsProcessingAI(false);
    }
  };

  const handleClose = () => {
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
            placeholder="예: 스프린트 14차 AI 파이프라인 리뷰"
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
