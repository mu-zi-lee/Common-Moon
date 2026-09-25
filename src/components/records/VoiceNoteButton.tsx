import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mic, Square, Loader2, Trash2 } from "lucide-react";
import { transcribeAudio } from "@/lib/transcribe.functions";

/**
 * One-tap voice note button. Records mic audio into a WAV, sends to STT,
 * and returns the transcript via `onTranscribed`.
 *
 * WAV encoding avoids the mp4/webm container mismatch on Safari.
 */
export function VoiceNoteButton({
  onTranscribed,
  maxSeconds = 60,
}: {
  onTranscribed: (text: string) => void;
  maxSeconds?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const transcribeFn = useServerFn(transcribeAudio);

  useEffect(() => {
    return () => stopStream();
  }, []);

  function stopStream() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => { /* noop */ });
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      chunksRef.current = [];
      processor.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(s);
        if (s >= maxSeconds) void stop();
      }, 250);
    } catch {
      toast.error("需要麦克风权限");
    }
  }

  async function stop() {
    if (!recording) return;
    setRecording(false);
    const ctx = audioCtxRef.current!;
    const rate = ctx.sampleRate;
    const chunks = chunksRef.current;
    stopStream();
    if (!chunks.length) return;
    const wav = encodeWav(chunks, rate);
    if (wav.size < 2048) {
      toast.error("录音太短了，再来一次");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await blobToDataUrl(wav);
      const { text } = await transcribeFn({ data: { audioDataUrl: dataUrl, hintLanguage: "zh" } });
      if (text) {
        onTranscribed(text);
        toast.success("已识别");
      } else {
        toast.info("没有识别到内容");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "识别失败");
    } finally {
      setUploading(false);
    }
  }

  async function cancel() {
    setRecording(false);
    stopStream();
    chunksRef.current = [];
  }

  if (uploading) {
    return (
      <button disabled className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-1 px-3 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 识别中…
      </button>
    );
  }

  if (recording) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          onClick={stop}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-semibold text-white"
        >
          <Square className="h-3 w-3 fill-current" strokeWidth={0} /> {elapsed}s · 停止
        </button>
        <button onClick={cancel} className="rounded-full p-2 text-muted-foreground" aria-label="取消">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-1 px-3 text-xs font-medium active:scale-95"
    >
      <Mic className="h-3.5 w-3.5" strokeWidth={1.6} /> 语音备注
    </button>
  );
}

/* -------------- wav encoder -------------- */

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const flat = flatten(chunks);
  const down = sampleRate > 16000 ? downsample(flat, sampleRate, 16000) : flat;
  const targetRate = sampleRate > 16000 ? 16000 : sampleRate;
  const buffer = new ArrayBuffer(44 + down.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + down.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, down.length * 2, true);
  for (let i = 0; i < down.length; i++) {
    const s = Math.max(-1, Math.min(1, down[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function flatten(chunks: Float32Array[]): Float32Array {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Float32Array(len);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

function downsample(buf: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate === fromRate) return buf;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(buf.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0, cnt = 0;
    for (let j = start; j < end && j < buf.length; j++) { sum += buf[j]; cnt++; }
    out[i] = cnt ? sum / cnt : 0;
  }
  return out;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
