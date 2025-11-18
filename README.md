# Stepper - 16-Step Drum Machine

A browser-based 16-step drum machine with 6 tracks, 10 synthesis engines, advanced FX chain, and pattern management.

## Features

### Synthesis Engines
- **808 Kick**: Classic pitch-swept kick drum with sub oscillator
- **FM Synth**: Frequency modulation synthesis for tonal percussion
- **Snare**: Hybrid FM tone + filtered noise
- **Noise**: Filtered white noise with density control
- **Modal**: Physical modeling with 7 resonant modes
- **Physical Model**: Membrane/drum head simulation
- **Additive**: Harmonic series synthesis
- **Abstract FM**: Complex FM with feedback and chaos
- **Karplus-Strong**: Plucked string physical model
- **Buchla Bongo**: Buchla-inspired bongo synthesis

### Effects Chain (Per Track + Master)
- **Wasp Filter**: Serial 4-pole lowpass with drive
- **Drive**: Waveshaping saturation
- **Distortion**: Exponential waveshaping
- **Resonator**: Tuned feedback delay
- **Delay**: Feedback delay line
- **Reverb**: Convolution reverb

### Sequencer Features
- 16 steps per pattern, 16 pattern slots
- Step conditions (1:1, 1:2, 2:2, 1:3, 2:3, 3:3, 1:4, 2:4, 3:4, 4:4)
- Parameter locks (P-locks) - store engine + params + FX per step
- Slide locks (S-locks) - smooth parameter automation between steps
- Velocity control per step (drag to adjust)
- Bar counter (1-4 bars)
- Tempo: 40-300 BPM

### Pattern Management
- 16-slot pattern bank
- Save/Copy/Clear patterns
- Magic button - loads random patterns from library with intelligent drum mapping
- Export/Import individual patterns
- Save/Load complete state as JSON

### Sound Morphing
- Per-track morphing: Generate random target parameters, morph smoothly
- Global morphing: Morph all tracks simultaneously
- Lock morphed values to commit changes
- FX parameters excluded from morphing for hybrid workflow

### Normal State System
- Each track stores a "Normal State" - snapshot of engine + params + FX
- Unlocked steps use Normal State for synthesis, current live FX settings
- P-locked steps use frozen parameters
- Allows real-time FX tweaking while maintaining consistent synthesis

## Usage

### Getting Started
1. Open `index.html` in a modern browser
2. Click anywhere to initialize audio
3. Click steps to activate them
4. Drag vertically on steps to adjust velocity
5. Press PLAY to start the sequencer

### Working with Tracks
- Click track to select it
- Right panel shows synthesis controls
- [M] - Mute track
- [R] - Randomize pattern
- [C] - Clear pattern

### Parameter Locking
- [P] button above step - Create parameter lock (stores engine + all params + FX)
- [S] button - Create slide (smooth automation to next step)
- Gold-tinted steps indicate parameter locks

### Step Conditions
- Click condition label below step (shows "1:1" by default)
- Select pattern: 1:1 (every bar), 1:2 (alternate bars), etc.
- Useful for creating evolving patterns over multiple bars

### Pattern Bank
- 16 numbered slots (01-16)
- Green dot indicates slot has data
- SAVE - Save current pattern to selected slot
- COPY - Copy slot to clipboard
- CLEAR - Clear selected slot
- MAGIC - Load random pattern from library

### Sound Morphing
1. Click GENERATE to create random target parameters
2. Use slider to morph between current and target
3. Click LOCK to commit morphed values
4. Global morph affects all tracks simultaneously

### Normal State
- SET NORMAL - Save current engine + params + FX as Normal State
- RECALL NORMAL - Restore Normal State
- Green dot indicates Normal State is saved
- Normal State is used for unlocked steps

## File Structure

```
/
├── index.html              # Minimal HTML loader
├── css/
│   └── styles.css         # Complete styling
├── js/
│   ├── main.js            # App initialization
│   ├── audio-engine.js    # Synthesis engines & FX
│   ├── sequencer.js       # Playback timing logic
│   ├── ui.js              # Rendering & interaction
│   ├── pattern-bank.js    # Pattern storage
│   └── state.js           # Application state
├── data/
│   └── patterns-source.json  # Magic pattern library
└── README.md
```

## Technical Details

- Pure vanilla JavaScript (ES6 modules)
- Web Audio API for synthesis
- No build step required
- Deployable to GitHub Pages
- Mobile responsive with overlay panel
- All synthesis happens in real-time (no samples)

## Browser Compatibility

- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

Requires Web Audio API support.

## Tips

- Use P-locks to create per-step sound variations
- Use S-locks for smooth pitch glides and filter sweeps
- Combine step conditions with pattern slots for long-form compositions
- Real-time FX tweaking works on all unlocked steps
- Magic button is great for instant inspiration
- Export JSON presets to save your favorite setups

## License

MIT License - Free for personal and commercial use

## Credits

Built to specification from comprehensive drum machine design document.
Inspired by classic hardware: TR-808, TR-909, Elektron machines, modular synthesizers.
