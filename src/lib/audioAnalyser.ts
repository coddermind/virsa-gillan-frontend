/**
 * Audio Analyser utility for real-time audio visualization
 * Based on Web Audio API AnalyserNode
 */

export class AudioAnalyser {
  private analyser: AnalyserNode;
  private bufferLength: number;
  private dataArray: Uint8Array;
  private animationFrameId: number | null = null;
  private onUpdate: (data: Uint8Array) => void;

  constructor(audioNode: AudioNode, onUpdate: (data: Uint8Array) => void) {
    const context = audioNode.context;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256; // Higher resolution for smoother waves
    this.analyser.smoothingTimeConstant = 0.8; // Smooth transitions
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.onUpdate = onUpdate;

    // Connect the audio node to the analyser
    audioNode.connect(this.analyser);
    this.start();
  }

  private update = () => {
    // Get frequency data (0-255 range)
    this.analyser.getByteFrequencyData(this.dataArray as any);
    this.onUpdate(this.dataArray as any);
    this.animationFrameId = requestAnimationFrame(this.update);
  };

  start() {
    if (!this.animationFrameId) {
      this.update();
    }
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  disconnect() {
    this.stop();
    this.analyser.disconnect();
  }

  get data(): Uint8Array {
    return this.dataArray;
  }
}

