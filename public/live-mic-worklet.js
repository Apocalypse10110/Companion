// Live Help microphone: turns the browser's audio (usually 44.1 or 48 kHz float) into
// 16 kHz 16-bit mono PCM, the format Gemini Live expects, in chunks of about 100 ms.
class LiveMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.carry = 0;
    this.buffer = new Int16Array(1600);
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    let level = 0;
    // Simple decimation with averaging: good enough for speech.
    let pos = this.carry;
    while (pos < input.length) {
      const start = Math.floor(pos);
      const end = Math.min(input.length, Math.floor(pos + this.ratio));
      let sum = 0;
      for (let i = start; i < end; i++) sum += input[i];
      const s = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
      level = Math.max(level, Math.abs(s));
      this.buffer[this.filled++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.filled === this.buffer.length) {
        this.port.postMessage({ pcm: this.buffer.buffer, level }, [this.buffer.buffer]);
        this.buffer = new Int16Array(1600);
        this.filled = 0;
        level = 0;
      }
      pos += this.ratio;
    }
    this.carry = pos - input.length;
    return true;
  }
}

registerProcessor("live-mic", LiveMicProcessor);
