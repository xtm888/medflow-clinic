import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Square, RotateCcw, Save, X, Volume2 } from 'lucide-react';

const AudioRecorder = ({ onSave, onCancel, maxDuration = 300 }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [waveform, setWaveform] = useState([]);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioElementRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopRecording();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup Web Audio API for visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Setup MediaRecorder
      const options = { mimeType: 'audio/webm' };
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Start duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);

      // Start visualization
      visualize();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  };

  const visualize = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      setVolumeLevel(average / 255);

      // Update waveform
      const waveformData = Array.from(dataArray)
        .filter((_, i) => i % 4 === 0) // Sample every 4th value
        .map(v => v / 255);
      setWaveform(waveformData);
    };

    draw();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setVolumeLevel(0);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const resetRecording = () => {
    stopRecording();
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setWaveform([]);
    audioChunksRef.current = [];
  };

  const playAudio = () => {
    if (!audioUrl) return;

    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(audioUrl);
      audioElementRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSave = () => {
    if (audioBlob) {
      onSave(audioBlob, duration);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Waveform Visualization */}
      <div className="bg-gray-900 rounded-lg p-4 h-32 flex items-center justify-center">
        {isRecording ? (
          <div className="flex items-end justify-center gap-1 h-full">
            {waveform.map((value, index) => (
              <div
                key={index}
                className="bg-red-500 rounded-t transition-all duration-100"
                style={{
                  height: `${value * 100}%`,
                  width: '4px',
                  opacity: 0.8 + value * 0.2
                }}
              />
            ))}
          </div>
        ) : audioUrl ? (
          <div className="text-center">
            <Volume2 size={32} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-400 text-sm">Recording ready</p>
          </div>
        ) : (
          <div className="text-center">
            <Mic size={32} className="mx-auto mb-2 text-gray-600" />
            <p className="text-gray-500 text-sm">Click record to start</p>
          </div>
        )}
      </div>

      {/* Timer Display */}
      <div className="text-center">
        <div className="text-3xl font-mono font-bold text-gray-800">
          {formatTime(duration)}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          Maximum duration: {formatTime(maxDuration)}
        </div>
      </div>

      {/* Volume Indicator */}
      {isRecording && (
        <div className="px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Volume</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-100 ${
                  volumeLevel > 0.7 ? 'bg-red-500' : volumeLevel > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${volumeLevel * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-3">
        {!isRecording && !audioUrl ? (
          <button
            onClick={startRecording}
            className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
          >
            <Mic size={24} />
          </button>
        ) : isRecording ? (
          <>
            {isPaused ? (
              <button
                onClick={resumeRecording}
                className="p-4 bg-green-600 text-white rounded-full hover:bg-green-700"
              >
                <Play size={24} />
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                className="p-4 bg-yellow-600 text-white rounded-full hover:bg-yellow-700"
              >
                <Pause size={24} />
              </button>
            )}
            <button
              onClick={stopRecording}
              className="p-4 bg-gray-600 text-white rounded-full hover:bg-gray-700"
            >
              <Square size={24} />
            </button>
          </>
        ) : audioUrl ? (
          <>
            <button
              onClick={playAudio}
              className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              onClick={resetRecording}
              className="p-4 bg-gray-600 text-white rounded-full hover:bg-gray-700"
            >
              <RotateCcw size={24} />
            </button>
          </>
        ) : null}
      </div>

      {/* Action Buttons */}
      {audioUrl && (
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            Save Recording
          </button>
        </div>
      )}

      {/* Instructions */}
      {!isRecording && !audioUrl && (
        <div className="text-center text-sm text-gray-500">
          <p>Click the record button to start recording</p>
          <p className="mt-1">Speak clearly into your microphone</p>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;