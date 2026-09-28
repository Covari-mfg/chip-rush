#!/usr/bin/env python3
"""Generate CHIP RUSH's original, seamless 104 BPM country/bluegrass music.

Requirements: Python 3.10+, numpy, FFmpeg with libmp3lame, and ffprobe.

Example:
    python3 generate_country_music.py --output-dir ./generated-music

Optional tool locations:
    --ffmpeg /path/to/ffmpeg --ffprobe /path/to/ffprobe

Outputs country-bluegrass-104.mp3, a lossless WAV master, and JSON containing
loop timing, provenance, content hashes, and numerical/codec QA. There is no
playback, browser controller, network download, or dependency on other scripts.

The composition, instruments, and note arrangement were created procedurally
for CHIP RUSH. No recorded samples, external music, or quoted melodies are used.
The music renders as a 16-bar cycle with circular echo/release tails. The
shipped master is normalized to -24 dBFS RMS; the game controls listening gain.

Byte identity depends on numpy/FFmpeg versions. The JSON records those versions
and output hashes so regenerated results can be compared with the shipped asset.
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
BPM = 104
BEATS = 64
FRAMES = round(BEATS * 60 / BPM * SR)
rng = np.random.default_rng(260925104)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def env(t, attack=.012, decay=.3, sustain=.4, release=.12):
    a = np.minimum(t / attack, 1)
    d = sustain + (1-sustain)*np.exp(-np.maximum(t-attack, 0)/decay)
    r = np.minimum(np.maximum(t[-1]-t, 0)/release, 1)
    return a*d*r


def tone(note, dur, voice):
    t = np.arange(max(2, int(dur*SR))) / SR
    f = hz(note)
    if voice == 'bass':
        x = np.sin(2*np.pi*f*t) + .29*np.sin(2*np.pi*f*2*t)*np.exp(-t/.16)
        x += .08*np.sin(2*np.pi*f*3*t)*np.exp(-t/.09)
        return x * env(t, .012, .16, .60, .065)
    raise ValueError(voice)


def noise_band(n, low, high):
    x = rng.normal(size=n)
    bins = np.fft.rfftfreq(n, 1/SR)
    # Smooth spectral envelope prevents a harsh edge to hats and brushes.
    mask = np.exp(-.5*(bins/high)**4)
    if low:
        mask *= 1 - np.exp(-.5*(bins/low)**4)
    y = np.fft.irfft(np.fft.rfft(x)*mask, n=n)
    return y/(np.sqrt(np.mean(y*y)) + 1e-10)


def drum(kind):
    if kind == 'kick':
        t = np.arange(int(.25*SR))/SR
        phase = 2*np.pi*(48*t + (95-48)*.022*(1-np.exp(-t/.022)))
        return np.sin(phase)*np.exp(-t/.070)*np.minimum(t/.0025, 1)
    if kind == 'snare':
        t = np.arange(int(.14*SR))/SR
        x = .72*noise_band(len(t), 330, 2200) + .3*np.sin(2*np.pi*185*t)
        return x*np.exp(-t/.035)*np.minimum(t/.003, 1)
    if kind == 'hat':
        t = np.arange(int(.085*SR))/SR
        return noise_band(len(t), 1800, 3900)*np.exp(-t/.016)*np.minimum(t/.003, 1)
    if kind == 'brush':
        t = np.arange(int(.23*SR))/SR
        return noise_band(len(t), 650, 2900)*np.exp(-t/.075)*np.minimum(t/.013, 1)
    if kind == 'rim':
        t = np.arange(int(.08*SR))/SR
        x = np.sin(2*np.pi*490*t)+.28*np.sin(2*np.pi*820*t)
        return x*np.exp(-t/.012)*np.minimum(t/.002, 1)
    raise ValueError(kind)


class Track:
    def __init__(self, bpm):
        self.bpm = bpm
        self.beat = 60/bpm
        self.end = 32*self.beat
        self.y = np.zeros((int((self.end+.95)*SR), 2), dtype=np.float64)

    def add(self, signal, beat, gain, pan=0, echo=0):
        start = max(0, int(beat*self.beat*SR))
        n = min(len(signal), len(self.y)-start)
        if n <= 0:
            return
        # Equal-power pan, with restrained width for background listening.
        left = math.cos((pan+1)*math.pi/4)
        right = math.sin((pan+1)*math.pi/4)
        self.y[start:start+n, 0] += gain*left*signal[:n]
        self.y[start:start+n, 1] += gain*right*signal[:n]
        if echo:
            for delay, level, swap in [(0.115, .16, False), (.23, .09, True)]:
                off = start+int(delay*SR)
                count = min(n, len(self.y)-off)
                if count > 0:
                    a, b = (right, left) if swap else (left, right)
                    self.y[off:off+count, 0] += gain*echo*level*a*signal[:count]
                    self.y[off:off+count, 1] += gain*echo*level*b*signal[:count]

    def note(self, note, beat, beats, voice, gain=.2, pan=0, echo=0):
        self.add(tone(note, beats*self.beat, voice), beat, gain, pan, echo)

    def chord(self, notes, beat, beats, voice, gain=.14, echo=0):
        for i, n in enumerate(notes):
            self.note(n, beat+i*.006, beats, voice, gain/math.sqrt(len(notes)),
                      -.25+.5*i/max(1, len(notes)-1), echo)

    def hit(self, kind, beat, gain, pan=0):
        self.add(drum(kind), beat, gain, pan)


def spectrum_filter(signal, low=0, high=3000, body=None):
    bins = np.fft.rfftfreq(len(signal), 1/SR)
    response = 1/np.sqrt(1+(bins/high)**8)
    if low:
        response *= 1-np.exp(-.5*(bins/low)**4)
    for frequency, width, amount in body or []:
        response *= 1+amount*np.exp(-.5*((bins-frequency)/width)**2)
    return np.fft.irfft(np.fft.rfft(signal)*response, n=len(signal))


def string_note(note, duration, kind='electric', muted=False, detune=0):
    """Modal vibrating string with a pick impulse and differentiated damping."""
    t = np.arange(max(2, int(duration*SR)))/SR
    f = hz(note)*2**(detune/1200)
    if kind == 'electric':
        pick=.19
        pickup=.105
        base_decay=.26 if muted else .76
        brightness=3500
        harmonic_slope=1.04
        stiffness=.000025
    elif kind == 'acoustic':
        pick=.24
        pickup=.37
        base_decay=.82
        brightness=3800
        harmonic_slope=1.25
        stiffness=.000045
    elif kind == 'banjo':
        pick=.135
        pickup=.29
        base_decay=.40
        brightness=3800
        harmonic_slope=.96
        stiffness=.000035
    else:
        raise ValueError(kind)
    x=np.zeros_like(t)
    for k in range(1, min(51,int(6000/f))):
        frequency=f*k*np.sqrt(1+stiffness*k*k)
        pluck_shape=np.sin(np.pi*k*pick)
        pickup_shape=np.sin(np.pi*k*pickup)
        amp=pluck_shape*pickup_shape/k**harmonic_slope
        amp*=np.exp(-(frequency/brightness)**2)
        decay=base_decay/(1+.085*k**1.26)
        # Higher modes decay faster, as in a damped plucked string.
        vibrato=.0015*np.sin(2*np.pi*4.5*t)*np.minimum(t/.25,1) if not muted else 0
        x+=amp*np.cos(2*np.pi*frequency*t+vibrato*k)*np.exp(-t/decay)
    x/=max(.001,float(np.max(np.abs(x))))
    # A very quiet pick transient gives articulation without a synthetic bleep.
    x+=.018*noise_band(len(t),300,2400)*np.exp(-t/.009)
    if kind == 'acoustic':
        x=spectrum_filter(x,65,3500,[(105,30,.30),(210,65,.45),(430,130,.15)])
    elif kind == 'banjo':
        # Restrained head/bridge resonance, with no piercing upper register.
        x=spectrum_filter(x,100,2850,[(480,125,.18),(1450,380,.22)])
        x+=.018*np.sin(2*np.pi*810*t)*np.exp(-t/.018)
    else:
        x=spectrum_filter(x,70,3400)
    attack=np.minimum(t/.0035,1)
    release=np.minimum(np.maximum(t[-1]-t,0)/(.045 if muted else .085),1)
    return x*attack*release


def strum(tr,notes,beat,beats,gain,upstroke=False):
    strings=list(reversed(notes)) if upstroke else notes
    for i,note in enumerate(strings):
        tr.add(string_note(note,beats*tr.beat,'acoustic'),beat+i*.012,
               gain/math.sqrt(len(strings)), -.28+i*.10,.30)


def add_country_arrangement(tr, start_beat=0):
    """Place the accepted eight-bar arrangement at an arbitrary beat offset."""
    roots=[31,36,31,38,31,36,38,31]
    chords=[[43,50,55,59,62],[48,52,55,60,64],[43,50,55,59,62],[50,57,62,66],
            [43,50,55,59,62],[48,52,55,60,64],[50,57,62,66],[43,50,55,59,62]]
    phrases=[[(55,.5),(59,1.5),(62,2.5),(59,3.0)],
             [(60,.5),(64,1.0),(67,2.5),(64,3.0)],
             [(62,.5),(59,1.5),(55,2.5)],
             [(57,.5),(62,1.0),(66,2.5),(62,3.0)],
             [(55,.5),(59,1.0),(62,2.5),(67,3.0)],
             [(64,.5),(60,1.5),(55,2.5)],
             [(57,.5),(62,1.0),(66,2.5),(62,3.0)],
             [(62,.5),(59,1.5),(55,2.5)]]
    for bar,r in enumerate(roots):
        b=start_beat+bar*4
        # Alternating bass and soft acoustic offbeats suggest a country two-step.
        for pos,interval,gain in [(0,0,.26),(2,7,.23)]:
            tr.note(r+interval,b+pos,1.18,'bass',gain)
            tr.add(string_note(r+12+interval,.54*tr.beat,'acoustic'),b+pos,.080,-.18,.15)
        strum(tr,chords[bar],b+1,.72,.19)
        strum(tr,chords[bar],b+3,.72,.19,upstroke=bool(bar%2))
        for note,pos in phrases[bar]:
            tr.add(string_note(note,.76*tr.beat,'banjo'),b+pos,.125,.19,.35)
        for pos in [0,2]:
            tr.hit('kick',b+pos,.13)
        for pos in [1,3]:
            tr.hit('brush',b+pos,.034,.03)
            tr.hit('rim',b+pos,.020,-.04)


def run(arguments):
    return subprocess.run(arguments,check=True,capture_output=True).stdout


def read_pcm(path):
    with wave.open(str(path),'rb') as f:
        assert f.getframerate()==SR and f.getnchannels()==2 and f.getsampwidth()==2
        return np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,2)/32768


def metrics(pcm):
    jump=float(np.max(np.abs(pcm[0]-pcm[-1])))
    steps=np.max(np.abs(np.diff(pcm,axis=0)),axis=1)
    return {
        'frames':len(pcm),
        'durationSeconds':len(pcm)/SR,
        'rmsDbfs':round(20*np.log10(np.sqrt(np.mean(pcm**2))),3),
        'peakDbfs':round(20*np.log10(np.max(np.abs(pcm))),3),
        'clippedSamples':int(np.count_nonzero(np.abs(pcm)>=32767/32768)),
        'meanDcOffset':float(np.mean(pcm)),
        'boundaryJumpAmplitude':jump,
        'boundaryJumpDbfs':round(20*np.log10(max(jump,1e-12)),3),
        'ordinaryAdjacentStep99Percentile':float(np.percentile(steps,99)),
        'last20msRmsDbfs':round(20*np.log10(max(np.sqrt(np.mean(pcm[-882:]**2)),1e-12)),3),
        'first20msRmsDbfs':round(20*np.log10(max(np.sqrt(np.mean(pcm[:882]**2)),1e-12)),3),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--output-dir', type=Path, required=True, help='Directory for generated MP3, WAV, and QA JSON')
    parser.add_argument('--basename', default='country-bluegrass-104', help='Output filename stem')
    parser.add_argument('--ffmpeg', default='ffmpeg', help='FFmpeg executable; defaults to PATH')
    parser.add_argument('--ffprobe', default='ffprobe', help='ffprobe executable; defaults to PATH')
    args = parser.parse_args()
    if Path(args.basename).name != args.basename or args.basename in ('', '.', '..'):
        parser.error('--basename must be a filename stem, not a path')
    OUT = args.output_dir.resolve()
    OUT.mkdir(parents=True, exist_ok=True)
    STEM = args.basename
    WAV = OUT / (STEM + '.wav')
    MP3 = OUT / (STEM + '.mp3')
    global rng
    rng = np.random.default_rng(260925104)
    track=Track(BPM)
    track.end=BEATS*track.beat
    track.y=np.zeros((FRAMES+SR,2),dtype=np.float64)
    for beat_offset in [0,32]:
        add_country_arrangement(track,beat_offset)
    # Circularly carry reverb/echo and release energy from the last bar into
    # bar one, as it would arrive after the first playback cycle.
    x=track.y[:FRAMES].copy()
    spill=track.y[FRAMES:]
    x[:len(spill)]+=spill
    x-=np.mean(x,axis=0)
    x=.85*np.tanh(x/.85)  # Same gentle audition master saturation.
    x*=10**(-24/20)/np.sqrt(np.mean(x*x))
    assert np.max(np.abs(x))<10**(-9/20)
    with wave.open(str(WAV),'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(np.round(x*32767).astype('<i2').tobytes())
    run([args.ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(WAV),
         '-c:a','libmp3lame','-b:a','160k','-ar',str(SR),'-write_xing','1',
         '-metadata','title=CHIP RUSH - Country loop (104 BPM)',str(MP3)])
    with tempfile.TemporaryDirectory(prefix='chip-loop-qa-') as temp:
        decoded=Path(temp)/'decoded.wav'
        run([args.ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(MP3),
             '-c:a','pcm_s16le',str(decoded)])
        mp3_pcm=read_pcm(decoded)
    wav_pcm=read_pcm(WAV)
    wav_stats=metrics(wav_pcm)
    mp3_stats=metrics(mp3_pcm)
    assert len(mp3_pcm)==len(wav_pcm)==FRAMES, 'MP3 gapless metadata must restore exact length'
    assert wav_stats['clippedSamples']==mp3_stats['clippedSamples']==0
    assert wav_stats['boundaryJumpAmplitude']<.002
    assert mp3_stats['boundaryJumpAmplitude']<.003
    probe=json.loads(run([args.ffprobe,'-v','error','-select_streams','a:0',
                         '-show_streams','-show_format','-of','json',str(MP3)]))
    packets=json.loads(run([args.ffprobe,'-v','error','-select_streams','a:0',
                           '-show_packets','-show_entries','packet=side_data_list',
                           '-of','json',str(MP3)]))
    side_data=[d for p in packets['packets'] for d in p.get('side_data_list',[])]
    metadata={
        'title':'CHIP RUSH country / bluegrass production loop',
        'bpm':BPM,'bars':16,'beatsPerBar':4,'sampleRate':SR,'channels':2,
        'loopStartSeconds':0,'loopEndSeconds':FRAMES/SR,
        'loopStartFrame':0,'loopEndFrameExclusive':FRAMES,
        'actualBpmFromFrameCount':BEATS*60/(FRAMES/SR),
        'progression':['G','C','G','D','G','C','D','G']*2,
        'arrangement':'Accepted country/bluegrass melody, rhythm, string synthesis, panning and gains, at 104 BPM. Two eight-bar passes, with deterministic pick/brush noise variation.',
        'mastering':'No intro fade or outro fade. Echo/release tails wrapped into the beginning. Full-loop RMS matched to -24 dBFS.',
        'files':{
            'wav':{'file':WAV.name,'bytes':WAV.stat().st_size,'sha256':hashlib.sha256(WAV.read_bytes()).hexdigest(),'qa':wav_stats},
            'mp3':{'file':MP3.name,'bytes':MP3.stat().st_size,'bitrate':160000,
                   'sha256':hashlib.sha256(MP3.read_bytes()).hexdigest(),'decodedQa':mp3_stats,
                   'containerDurationSeconds':float(probe['format']['duration']),
                   'containerStartTimeSeconds':float(probe['streams'][0].get('start_time',0)),
                   'gaplessSideData':side_data},
        },
        'browserPlayback':'Use decodeAudioData + AudioBufferSourceNode with loop=true, loopStart=0, loopEnd=36.92308390022676. Verify decoded duration. The MP3 includes Xing/LAME gapless metadata; FFmpeg decode returns exactly 1628308 PCM frames. If a browser decoder does not trim MP3 padding correctly, use the WAV fallback. Do not loop with an HTML ended-event callback.',
        'provenance':'Original procedural composition and synthesized instruments created for CHIP RUSH / Covari. The shipped country-bluegrass-104.mp3 contains no external recordings, sampled audio, downloaded music, or quoted song melodies. This generator uses arithmetic synthesis and deterministic noise; no separate third-party sample or stock-music license was used.',
        'qaBoundary':'Numerical and codec round-trip checks only; no subjective listening or browser playback test performed by this generator.',
        'generator':Path(__file__).name,
        'dependencies':['Python 3.10+ and numpy','FFmpeg with libmp3lame and ffprobe'],
        'toolVersions':{'python':platform.python_version(),'numpy':np.__version__,
                        'ffmpeg':run([args.ffmpeg,'-version']).decode().splitlines()[0]},
    }
    (OUT/(STEM+'.json')).write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps(metadata,indent=2))


if __name__ == '__main__':
    main()
