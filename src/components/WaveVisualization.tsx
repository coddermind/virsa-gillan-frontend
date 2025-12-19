"use client";

import { useEffect, useRef, useState } from "react";
import { AudioAnalyser } from "@/lib/audioAnalyser";

interface WaveVisualizationProps {
  inputNode: GainNode | null;
  outputNode: GainNode | null;
  isListening: boolean;
  isSpeaking: boolean;
  containerBg?: string;
}

export default function WaveVisualization({
  inputNode,
  outputNode,
  isListening,
  isSpeaking,
  containerBg = "#ffffff",
}: WaveVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputAnalyserRef = useRef<AudioAnalyser | null>(null);
  const outputAnalyserRef = useRef<AudioAnalyser | null>(null);
  const [inputData, setInputData] = useState<Uint8Array | null>(null);
  const [outputData, setOutputData] = useState<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize analysers when nodes are available
  useEffect(() => {
    if (inputNode && !inputAnalyserRef.current) {
      inputAnalyserRef.current = new AudioAnalyser(inputNode, (data) => {
        setInputData(data);
      });
    }

    if (outputNode && !outputAnalyserRef.current) {
      outputAnalyserRef.current = new AudioAnalyser(outputNode, (data) => {
        setOutputData(data);
      });
    }

    return () => {
      if (inputAnalyserRef.current) {
        inputAnalyserRef.current.disconnect();
        inputAnalyserRef.current = null;
      }
      if (outputAnalyserRef.current) {
        outputAnalyserRef.current.disconnect();
        outputAnalyserRef.current = null;
      }
    };
  }, [inputNode, outputNode]);

  // Draw waveform animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Determine which data to visualize
      const data = isSpeaking && outputData ? outputData : isListening && inputData ? inputData : null;
      const isActive = isListening || isSpeaking;

      if (!data || !isActive) {
        // Draw idle state - subtle pulse
        const centerY = height / 2;
        const barCount = 32;
        const barWidth = width / barCount;
        const idleHeight = height * 0.1;

        ctx.fillStyle = "rgba(156, 163, 175, 0.3)";
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth;
          ctx.fillRect(x, centerY - idleHeight / 2, barWidth - 2, idleHeight);
        }
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Draw active waveform
      const barCount = data.length;
      const barWidth = width / barCount;
      const centerY = height / 2;

      // Create gradient based on state
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      if (isListening) {
        // Blue gradient for listening
        gradient.addColorStop(0, "rgba(59, 130, 246, 0.8)"); // blue-500
        gradient.addColorStop(0.5, "rgba(96, 165, 250, 0.6)"); // blue-400
        gradient.addColorStop(1, "rgba(147, 197, 253, 0.4)"); // blue-300
      } else if (isSpeaking) {
        // Green gradient for speaking
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.8)"); // emerald-500
        gradient.addColorStop(0.5, "rgba(52, 211, 153, 0.6)"); // emerald-400
        gradient.addColorStop(1, "rgba(110, 231, 183, 0.4)"); // emerald-300
      }
      ctx.fillStyle = gradient;

      // Draw symmetric waveform bars
      for (let i = 0; i < barCount; i++) {
        const value = data[i];
        const normalizedValue = value / 255;
        const barHeight = normalizedValue * (height * 0.4); // Max 40% of height

        const x = i * barWidth;
        const y = centerY - barHeight / 2;

        // Smooth rounded rectangles
        ctx.fillRect(x, y, barWidth - 2, barHeight);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [inputData, outputData, isListening, isSpeaking]);

  // Set canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div className="relative w-full h-24 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-24 rounded-lg"
        style={{
          backgroundColor: containerBg,
          opacity: isListening || isSpeaking ? 1 : 0.5,
          transition: "opacity 0.3s ease-in-out",
        }}
      />
      {/* Glowing effect overlay */}
      {(isListening || isSpeaking) && (
        <div
          className={`absolute inset-0 rounded-lg pointer-events-none ${
            isListening
              ? "bg-blue-500/20"
              : "bg-green-500/20"
          }`}
          style={{
            boxShadow: isListening
              ? "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)"
              : "0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)",
            animation: "glow-pulse 2s ease-in-out infinite",
          }}
        />
      )}
      <style jsx>{`
        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}

