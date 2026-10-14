#!/usr/bin/env python3
"""Generate Launch Window's original 120 BPM countdown score as three stems.

Requirements: Python 3.10+, numpy, FFmpeg with libmp3lame, and ffprobe.

Example:
    python3 generate_launch_music.py --output-dir ./generated-music

Launch Window layers its music by how close the count is to zero, so the
score is three synchronised loops of identical length rather than one mix:

  launch-base-120.mp3    pad, sub-bass pulse and a ticking countdown clock
  launch-drive-120.mp3   sixteenth-note arpeggio and a light kit
  launch-climax-120.mp3  a heroic lead line, four-on-the-floor kick, tom fills

The game always plays the base, brings in the drive once the shop is moving,
and the climax for the last minute. All stems share one gain, so any mix of
them keeps its balance. Each stem is a 16-bar loop (32 s) whose echo and
release tails are wrapped into its first bar, so it repeats seamlessly.

The composition, instruments and note arrangement were created procedurally
for CHIP RUSH. No recorded samples, external music or quoted melodies are used.
Outputs: the three MP3s, lossless WAV masters, and JSON with loop timing,
provenance, content hashes and numerical/codec QA.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import platform
import subprocess
import tempfile
import wave
import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
BEATS = 64
FRAMES = round(BEATS * BEAT * SR)
SEED = 20261014
rng = np.random.default_rng(SEED)

# D minor, cinematic: two eight-bar phrases, the second lifting through Gm.
CHORDS = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'F', 'C', 'Gm', 'Bb', 'C', 'A']
VOICING = {'Dm': [50, 57, 62, 65], 'Bb': [46, 53, 58, 62], 'F': [48, 53, 57, 60], 'C': [48, 55, 60, 64],
           'Gm': [43, 50, 55, 58], 'A': [45, 52, 57, 61]}
ROOT = {'Dm': 38, 'Bb': 34, 'F': 41, 'C': 36, 'Gm': 31, 'A': 33}
ARP = {'Dm': [62, 65, 69, 74], 'Bb': [58, 62, 65, 70], 'F': [60, 65, 69, 72], 'C': [60, 64, 67, 72],
       'Gm': [58, 62, 67, 70], 'A': [61, 64, 69, 73]}
# (MIDI note, beat within bar, beats) per bar.
MELODY = [
    [(69, 0, 1.5), (74, 1.5, .5), (76, 2, 1), (77, 3, 1)],
    [(77, 0, 1.5), (76, 1.5, .5), (74, 2, 1), (72, 3, 1)],
    [(72, 0, 2), (69, 2, 1), (72, 3, 1)],
    [(76, 0, 1.5), (79, 1.5, .5), (76, 2, 1), (72, 3, 1)],
    [(74, 0, 1.5), (69, 1.5, .5), (74, 2, 1), (77, 3, 1)],
    [(77, 0, 1), (79, 1, 1), (77, 2, 1), (74, 3, 1)],
    [(82, 0, 1.5), (81, 1.5, .5), (79, 2, 1), (74, 3, 1)],
    [(76, 0, 2), (73, 2, 1), (76, 3, 1)],
    [(81, 0, 2), (77, 2, 1), (74, 3, 1)],
    [(82, 0, 1.5), (81, 1.5, .5), (79, 2, 1), (77, 3, 1)],
    [(81, 0, 2), (84, 2, 1), (81, 3, 1)],
    [(79, 0, 2), (76, 2, 1), (79, 3, 1)],
    [(82, 0, 1.5), (81, 1.5, .5), (79, 2, 1), (82, 3, 1)],
    [(86, 0, 2), (84, 2, 1), (82, 3, 1)],
    [(84, 0, 1.5), (79, 1.5, .5), (76, 2, 1), (79, 3, 1)],
    [(81, 0, 3), (76, 3, 1)],
]


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def adsr(n, attack, decay, sustain, release):
    t = np.arange(n) / SR
    a = np.minimum(t / max(attack, 1e-4), 1)
    d = sustain + (1 - sustain) * np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-4))
    r = np.minimum(np.maximum(t[-1] - t, 0) / max(release, 1e-4), 1)
    return a * d * r


def saw(freq, t, partials=24, ceiling=9000):
    """Band-limited sawtooth by additive synthesis."""
    x = np.zeros_like(t)
    for k in range(1, partials + 1):
        if k * freq > ceiling:
            break
        x += ((-1) ** (k + 1)) / k * np.sin(2 * np.pi * k * freq * t)
    return x * (2 / np.pi)


def square(freq, t, partials=15, ceiling=8000):
    x = np.zeros_like(t)
    for k in range(1, 2 * partials, 2):
        if k * freq > ceiling:
            break
        x += np.sin(2 * np.pi * k * freq * t) / k
    return x * (4 / np.pi)


def noise_band(n, low, high):
    x = rng.normal(size=n)
    bins = np.fft.rfftfreq(n, 1 / SR)
    mask = np.exp(-.5 * (bins / high) ** 4)
    if low:
        mask *= 1 - np.exp(-.5 * (bins / low) ** 4)
    y = np.fft.irfft(np.fft.rfft(x) * mask, n=n)
    return y / (np.sqrt(np.mean(y * y)) + 1e-10)


def lowpass(signal, cutoff, low=0):
    bins = np.fft.rfftfreq(len(signal), 1 / SR)
    response = 1 / np.sqrt(1 + (bins / cutoff) ** 6)
    if low:
        response *= 1 - np.exp(-.5 * (bins / low) ** 4)
    return np.fft.irfft(np.fft.rfft(signal) * response, n=len(signal))


def pad_voice(note, beats):
    n = int(beats * BEAT * SR) + int(.6 * SR)
    t = np.arange(n) / SR
    x = sum(saw(hz(note) * 2 ** (c / 1200), t, 14, 5000) for c in (-7, 0, 6)) / 3
    x += .35 * np.sin(2 * np.pi * hz(note) / 2 * t)
    return x * adsr(n, .35, 1.2, .78, .55)


def sub(note, beats):
    n = int(beats * BEAT * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * hz(note) * t) + .18 * saw(hz(note), t, 6, 600)
    return x * adsr(n, .006, .12, .55, .05)


def tick(accent):
    n = int(.05 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * (3150 if accent else 2350) * t) * np.exp(-t / .006)
    click = noise_band(n, 3000, 9000) * np.exp(-t / .004)
    return .7 * tone + .4 * click


def pluck(note, beats):
    n = int(beats * BEAT * SR) + int(.25 * SR)
    t = np.arange(n) / SR
    x = .6 * saw(hz(note), t, 18, 7000) + .4 * square(hz(note) * 1.002, t, 9, 6000)
    bright = np.exp(-t / .09)
    x = x * (.35 + .65 * bright)
    return x * adsr(n, .003, .16, .12, .12)


def lead(note, beats):
    n = int(beats * BEAT * SR) + int(.2 * SR)
    t = np.arange(n) / SR
    vib = 1 + .0045 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(t / .35, 1)
    phase = np.cumsum(hz(note) * vib) / SR
    x = np.zeros_like(t)
    for k in range(1, 16):
        if k * hz(note) > 7500:
            break
        x += ((-1) ** (k + 1)) / k * np.sin(2 * np.pi * k * phase)
    x = .7 * x * (2 / np.pi) + .3 * np.sin(2 * np.pi * phase * 2) * .5
    return x * adsr(n, .025, .4, .7, .14)


def drum(kind):
    if kind == 'kick':
        t = np.arange(int(.32 * SR)) / SR
        phase = 2 * np.pi * (46 * t + (130 - 46) * .03 * (1 - np.exp(-t / .03)))
        return np.sin(phase) * np.exp(-t / .11) * np.minimum(t / .002, 1)
    if kind == 'snare':
        t = np.arange(int(.2 * SR)) / SR
        x = .8 * noise_band(len(t), 900, 6500) + .35 * np.sin(2 * np.pi * 196 * t)
        return x * np.exp(-t / .05) * np.minimum(t / .002, 1)
    if kind == 'hat':
        t = np.arange(int(.06 * SR)) / SR
        return noise_band(len(t), 6000, 12000) * np.exp(-t / .012) * np.minimum(t / .001, 1)
    if kind.startswith('tom'):
        f = {'tom1': 150, 'tom2': 118, 'tom3': 92}[kind]
        t = np.arange(int(.38 * SR)) / SR
        phase = 2 * np.pi * (f * t + f * .6 * .05 * (1 - np.exp(-t / .05)))
        return (np.sin(phase) + .15 * noise_band(len(t), 200, 2000) * np.exp(-t / .03)) * np.exp(-t / .16)
    raise ValueError(kind)


class Stem:
    def __init__(self):
        self.y = np.zeros((FRAMES + 2 * SR, 2))

    def add(self, signal, beat, gain, pan=0, echo=0):
        start = int(round(beat * BEAT * SR))
        n = min(len(signal), len(self.y) - start)
        if n <= 0:
            return
        left, right = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        self.y[start:start + n, 0] += gain * left * signal[:n]
        self.y[start:start + n, 1] += gain * right * signal[:n]
        # Dotted-eighth ping-pong echo, the classic synth-score delay.
        for repeat in range(1, 4 if echo else 1):
            offset = start + int(repeat * .75 * BEAT * SR)
            count = min(n, len(self.y) - offset)
            if count <= 0:
                break
            level = gain * echo * (.42 ** repeat)
            a, b = (right, left) if repeat % 2 else (left, right)
            self.y[offset:offset + count, 0] += level * a * signal[:count]
            self.y[offset:offset + count, 1] += level * b * signal[:count]

    def loop(self):
        # Carry tails from past the loop end into its start: the next cycle.
        x = self.y[:FRAMES].copy()
        spill = self.y[FRAMES:]
        x[:len(spill)] += spill
        return x


def compose():
    base, drive, climax = Stem(), Stem(), Stem()
    for bar, chord in enumerate(CHORDS):
        b = bar * 4
        for i, note in enumerate(VOICING[chord]):
            base.add(pad_voice(note, 4), b + i * .01, .085, -.45 + .3 * i)
        # Sub pulse on eighths, ducked on the beat like a side-chained synth bass.
        for e in range(8):
            base.add(sub(ROOT[chord], .5), b + e * .5, .15 if e % 2 else .09)
        # The countdown clock: tick on each beat, accented on the bar.
        for q in range(4):
            base.add(tick(q == 0), b + q, .05 if q == 0 else .032, .25 if q % 2 else -.25)
        # Drive: rolling arpeggio, light kit.
        pattern = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
        for s, step in enumerate(pattern):
            note = ARP[chord][step]
            drive.add(pluck(note, .25), b + s * .25, .055 if s % 4 else .07, -.35 if s % 2 else .35, echo=.3)
        for q in (0, 2, 3.5) if bar % 2 else (0, 2):
            drive.add(drum('kick'), b + q, .2)
        for q in (1, 3):
            drive.add(drum('snare'), b + q, .085, .05)
        for e in range(8):
            drive.add(drum('hat'), b + e * .5 + (.02 if e % 2 else 0), .028 if e % 2 else .02, .3)
        # Climax: lead line, four on the floor, toms into each phrase.
        for note, at, beats in MELODY[bar]:
            climax.add(lead(note, beats), b + at, .085, -.1, echo=.25)
            climax.add(lead(note - 12, beats), b + at, .03, .15)
        for q in range(4):
            climax.add(drum('kick'), b + q, .16)
        if bar % 4 == 3:
            for i, (kind, at) in enumerate([('tom1', 2), ('tom1', 2.5), ('tom2', 3), ('tom3', 3.5)]):
                climax.add(drum(kind), b + at, .16, -.4 + .27 * i)
        for q in (1.5, 3.5):
            climax.add(drum('hat'), b + q, .04, -.3)
    stems = {'base': base.loop(), 'drive': drive.loop(), 'climax': climax.loop()}
    # Voice the pad warm: roll off its fizz; keep the arp and lead brighter.
    stems['base'] = np.stack([lowpass(stems['base'][:, c], 2600) for c in range(2)], axis=1)
    stems['drive'] = np.stack([lowpass(stems['drive'][:, c], 7000, 40) for c in range(2)], axis=1)
    stems['climax'] = np.stack([lowpass(stems['climax'][:, c], 6500, 35) for c in range(2)], axis=1)
    for key in stems:
        stems[key] -= np.mean(stems[key], axis=0)
    # One shared gain: the full mix sits at -21 dBFS RMS, stems keep their balance.
    full = sum(stems.values())
    gain = 10 ** (-21 / 20) / np.sqrt(np.mean(full * full))
    return {key: .9 * np.tanh(value * gain / .9) for key, value in stems.items()}


def run(arguments):
    return subprocess.run(arguments, check=True, capture_output=True).stdout


def read_pcm(path):
    with wave.open(str(path), 'rb') as f:
        assert f.getframerate() == SR and f.getnchannels() == 2 and f.getsampwidth() == 2
        return np.frombuffer(f.readframes(f.getnframes()), dtype='<i2').reshape(-1, 2) / 32768


def metrics(pcm):
    jump = float(np.max(np.abs(pcm[0] - pcm[-1])))
    return {
        'frames': len(pcm), 'durationSeconds': len(pcm) / SR,
        'rmsDbfs': round(20 * np.log10(np.sqrt(np.mean(pcm ** 2))), 3),
        'peakDbfs': round(20 * np.log10(np.max(np.abs(pcm))), 3),
        'clippedSamples': int(np.count_nonzero(np.abs(pcm) >= 32767 / 32768)),
        'boundaryJumpAmplitude': jump,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--output-dir', type=Path, required=True, help='Directory for MP3, WAV and QA JSON')
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--ffprobe', default='ffprobe')
    args = parser.parse_args()
    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    stems = compose()
    files = {}
    for key, x in stems.items():
        stem = f'launch-{key}-120'
        wav, mp3 = out / f'{stem}.wav', out / f'{stem}.mp3'
        with wave.open(str(wav), 'wb') as f:
            f.setnchannels(2)
            f.setsampwidth(2)
            f.setframerate(SR)
            f.writeframes(np.round(x * 32767).astype('<i2').tobytes())
        run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '112k',
             '-ar', str(SR), '-write_xing', '1', '-metadata', f'title=CHIP RUSH - Launch Window {key} (120 BPM)', str(mp3)])
        with tempfile.TemporaryDirectory(prefix='launch-qa-') as temp:
            decoded = Path(temp) / 'decoded.wav'
            run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(mp3), '-c:a', 'pcm_s16le', str(decoded)])
            mp3_pcm = read_pcm(decoded)
        wav_stats, mp3_stats = metrics(read_pcm(wav)), metrics(mp3_pcm)
        assert len(mp3_pcm) == FRAMES, 'MP3 gapless metadata must restore the exact loop length'
        assert wav_stats['clippedSamples'] == mp3_stats['clippedSamples'] == 0
        files[key] = {
            'wav': {'file': wav.name, 'sha256': hashlib.sha256(wav.read_bytes()).hexdigest(), 'qa': wav_stats},
            'mp3': {'file': mp3.name, 'bytes': mp3.stat().st_size, 'bitrate': 112000,
                    'sha256': hashlib.sha256(mp3.read_bytes()).hexdigest(), 'decodedQa': mp3_stats},
        }
    full = sum(stems.values())
    metadata = {
        'title': 'CHIP RUSH Launch Window countdown score', 'bpm': BPM, 'bars': 16, 'beatsPerBar': 4,
        'sampleRate': SR, 'channels': 2, 'loopStartSeconds': 0, 'loopEndSeconds': FRAMES / SR, 'loopEndFrameExclusive': FRAMES,
        'progression': CHORDS, 'key': 'D minor',
        'layers': {'base': 'pad, side-chained sub pulse, countdown clock ticks', 'drive': 'sixteenth arpeggio with dotted-eighth echo, kick/snare/hats',
                   'climax': 'lead melody with octave double, four-on-the-floor kick, tom fills'},
        'mixRmsDbfs': round(20 * np.log10(np.sqrt(np.mean(full ** 2))), 3),
        'files': files,
        'browserPlayback': 'Decode each stem with decodeAudioData and start all three AudioBufferSourceNodes at the same context time with loop=true, loopStart=0, loopEnd=32. Layer them with per-stem gains.',
        'provenance': 'Original procedural composition and synthesized instruments created for CHIP RUSH / Covari (Launch Window, Claude Opus 5.5 in Claude Code). No external recordings, sampled audio, downloaded music or quoted melodies.',
        'qaBoundary': 'Numerical and codec round-trip checks only; listening and browser playback are verified separately.',
        'generator': Path(__file__).name, 'seed': SEED,
        'toolVersions': {'python': platform.python_version(), 'numpy': np.__version__,
                         'ffmpeg': run([args.ffmpeg, '-version']).decode().splitlines()[0]},
    }
    (out / 'launch-window-120.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps({k: v['mp3']['decodedQa'] for k, v in files.items()}, indent=2), metadata['mixRmsDbfs'])


if __name__ == '__main__':
    main()
