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
