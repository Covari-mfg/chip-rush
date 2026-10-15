# CHIP RUSH country music

The shipped `country-bluegrass-104.mp3` is an original procedural instrumental created for CHIP RUSH / Covari. Its bass, acoustic strings, banjo-like picking, and light percussion are synthesized mathematically using deterministic noise and harmonic string models. No external recordings, sampled audio, downloaded music, stock music, or quoted song melodies were used.

The selected arrangement is a 16-bar country / bluegrass cycle at 104 BPM. Echo and release tails wrap into the beginning so it repeats without the audition's intro or outro fade. Listening volume and phone-call ducking are controlled by the game, separately from this asset.

## Reproduce

Requirements: Python 3.10 or newer, numpy, FFmpeg with the `libmp3lame` encoder, and ffprobe.

```sh
python3 scripts/music/generate_country_music.py --output-dir ./generated-music
```

The script writes `country-bluegrass-104.mp3`, a lossless WAV master, and a JSON file containing timing, provenance, hashes, tool versions, and numerical QA. `--ffmpeg` and `--ffprobe` accept executable paths; by default the tools are resolved through `PATH`. `--basename` optionally changes the output filename stem. The generator is self-contained and never plays audio or downloads assets.

The portable generator reproduced the current MP3 and WAV byte-for-byte with Python 3.12.14, numpy 2.3.5, and FFmpeg 8.1.2. Different numerical or encoder versions can change hashes while preserving the composition and timing.

## Shipped asset

- MP3: 739,878 bytes, stereo, 44.1 kHz, 160 kbps.
- SHA-256: `7a55303b9257845a6e4a1546ded8cdb69862391a5af18bdf743407ce22faca36`.
- Decoded loop: 1,628,308 frames; start `0`, end `36.92308390022676` seconds.
- Decoded RMS: -24.446 dBFS; peak: -9.948 dBFS; zero clipped samples.
- The MP3 includes gapless metadata. The generator confirms exact decoded length through an FFmpeg round trip.
- Playback integration should use a decoded Web Audio buffer with those loop bounds. Browser playback verification is separate from the generator's numerical QA.

No separate third-party sample or stock-music license was used. This provenance statement does not assign a new software license; repository licensing governs the checked-in source.

# Launch Window countdown score

`launch-base-120.mp3`, `launch-drive-120.mp3` and `launch-climax-120.mp3` are an original procedural 120 BPM D-minor score made for Launch Window (Claude Opus 5.5 in Claude Code). Pad, sub bass, clock ticks, arpeggio, lead and drums are synthesized arithmetically with deterministic noise (seed 20261014). No recordings, samples, downloaded or stock music, or quoted melodies were used.

The three stems share one length (16 bars, exactly 1,411,200 frames, 32 s) and one gain, so the game can layer them: the base always, the drive once the shop is moving, the climax in the last minute. Echo and release tails wrap into bar one so each loops seamlessly.

```sh
python3 scripts/music/generate_launch_music.py --output-dir ./generated-music
```

The script writes the MP3s (112 kbps, gapless metadata), WAV masters and `launch-window-120.json` with loop timing, hashes, tool versions and numerical QA (zero clipped samples; decoded length checked through an FFmpeg round trip). Generated with Python 3.14.4, NumPy 2.4.3 and Homebrew FFmpeg. QA is numerical; no listening test is recorded.

# Last Light harbor score

Last Light's `harbor` track is an original procedural 92 BPM, eight-bar D-major instrumental created in Codex by the delegated GPT-6.1 Sol audio agent for the GPT-6.1 Sol level collaboration. Its low string-like harmony, soft marimba, glass bells, stereo echoes and gentle sea hush are synthesized inside `buildHarborBuffer` in `dist/audio.js`, using Web Audio buffers and deterministic arithmetic (noise seed 20261015). No recordings, samples, downloaded or stock music, quoted melodies, paid services or additional audio files were used.

The Dmaj9 / Bm7 / Gmaj9 / A6 cycle lasts approximately 20.869565 seconds (32 beats). Notes and echoes wrap into the beginning; the noise filter warms from the end of its own cycle. The buffer uses the browser's sample rate and normalizes to 0.085 RMS with a 0.65 peak ceiling before the game's existing music/master gains and ducking. The two tender-horn tones and rising beacon bells are also synthesized locally. Numerical tests cover loop bounds, finite samples, headroom, stereo placement, the loop seam, deterministic construction and playback transitions; those checks are separate from listening evidence.
