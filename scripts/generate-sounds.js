import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const soundsDir = path.resolve(__dirname, '../public/sounds');

if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

// Generate simple pleasant sine wave chime WAV file in pure Node
function generateWavChime(filename, freq1 = 880, freq2 = 1320, durationSec = 0.8) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const blockAlign = 2; // 16-bit mono = 2 bytes
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28);   // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Envelope: exponential decay
    const envelope = Math.exp(-4.5 * t);
    // Two-tone harmonic chime
    const sampleVal = (Math.sin(2 * Math.PI * freq1 * t) * 0.6 + Math.sin(2 * Math.PI * freq2 * t) * 0.4) * envelope;
    const intVal = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 32767)));
    buffer.writeInt16LE(intVal, 44 + i * 2);
  }

  fs.writeFileSync(path.join(soundsDir, filename), buffer);
}

generateWavChime('bell.wav', 880, 1320, 0.7);
generateWavChime('chime.wav', 587, 880, 0.9);
console.log('✅ Generated sample sound files in public/sounds/');
