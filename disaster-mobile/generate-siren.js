// Generates a WAV siren sound file for Android notification channel
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 5; // seconds
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function generateSiren() {
  const buffer = Buffer.alloc(TOTAL_SAMPLES * 2); // 16-bit = 2 bytes per sample
  
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    
    // Siren: oscillate frequency between 440Hz and 880Hz over 1-second cycles
    const cyclePos = (t % 1.0); // Position in current 1-second cycle
    const goingUp = Math.floor(t) % 2 === 0;
    const freq = goingUp 
      ? 440 + cyclePos * 440   // 440 -> 880
      : 880 - cyclePos * 440;  // 880 -> 440
    
    // Generate sawtooth wave
    const phase = (t * freq) % 1.0;
    const sawtooth = 2 * phase - 1;
    
    // Amplitude envelope (slight fade in/out)
    let amplitude = 0.6;
    if (t < 0.05) amplitude *= t / 0.05; // Fade in
    if (t > DURATION - 0.05) amplitude *= (DURATION - t) / 0.05; // Fade out
    
    const sample = Math.max(-1, Math.min(1, sawtooth * amplitude));
    const intSample = Math.round(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }
  
  return buffer;
}

function createWavFile(audioData) {
  const dataSize = audioData.length;
  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // Chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(NUM_CHANNELS, 22); // Channels
  header.writeUInt32LE(SAMPLE_RATE, 24);  // Sample rate
  header.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE / 8, 28); // Byte rate
  header.writeUInt16LE(NUM_CHANNELS * BITS_PER_SAMPLE / 8, 32); // Block align
  header.writeUInt16LE(BITS_PER_SAMPLE, 34); // Bits per sample
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  return Buffer.concat([header, audioData]);
}

const audioData = generateSiren();
const wavFile = createWavFile(audioData);
const outputPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', 'raw', 'siren.wav');

fs.writeFileSync(outputPath, wavFile);
console.log(`Siren WAV generated: ${outputPath} (${wavFile.length} bytes, ${DURATION}s)`);
