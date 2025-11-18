// State management for the drum machine

export const state = {
    isPlaying: false,
    tempo: 128,
    currentStep: -1,
    currentBar: 0,
    stepInBar: 0,
    selectedTrack: 'kick',
    conditionModalStep: null,
    conditionModalTrack: null,
    globalMorphAmount: 0,
    globalTargetParams: null,
    currentPattern: 0,
    masterFX: {
        waspFilter: 0,
        waspFreq: 2000,
        waspRes: 5,
        waspDrive: 2,
        drive: 1,
        distortion: 0,
        resonator: 0,
        resFreq: 440,
        resDecay: 0.3,
        delay: 0,
        delayTime: 0.25,
        reverb: 0,
        reverbSize: 2
    },
    tracks: {}
};

export function initializeTrack(trackId, name, engine) {
    const track = {
        id: trackId,
        name: name,
        mute: false,
        engine: engine,
        params: getDefaultParams(engine),
        fx: {
            waspFilter: 0,
            waspFreq: 2000,
            waspRes: 5,
            waspDrive: 2,
            drive: 1,
            distortion: 0,
            resonator: 0,
            resFreq: 440,
            resDecay: 0.3,
            delay: 0,
            delayTime: 0.25,
            reverb: 0,
            reverbSize: 2
        },
        normalState: null,
        morphAmount: 0,
        targetParams: null,
        steps: Array(16).fill(false),
        velocities: Array(16).fill(0.8),
        stepConditions: Array(16).fill('1:1'),
        stepLocks: Array(16).fill(null),
        stepSlides: Array(16).fill(false)
    };
    
    // Initialize normal state
    track.normalState = {
        engine: engine,
        params: { ...track.params },
        fx: { ...track.fx }
    };
    
    state.tracks[trackId] = track;
    return track;
}

function getDefaultParams(engine) {
    const defaults = {
        '808': {
            pitch: 1.0,
            pitchDecay: 0.05,
            decay: 0.5,
            punch: 1,
            drive: 1,
            sub: 0.3,
            click: 0,
            attack: 0.001
        },
        'fm': {
            pitch: 200,
            fmRatio: 1.6,
            fmAmount: 180,
            fmDecay: 0.15,
            decay: 0.15,
            tone: 0.8,
            filterQ: 1,
            attack: 0.001
        },
        'snare': {
            pitch: 200,
            fmRatio: 1.6,
            fmAmount: 180,
            toneDecay: 0.08,
            noiseAmount: 0.65,
            noiseDecay: 0.12,
            snap: 1.5,
            tone: 1.2
        },
        'noise': {
            tone: 1.8,
            spread: 12,
            decay: 0.04,
            attack: 0.001,
            shape: 1,
            density: 1,
            filterType: 1
        },
        'modal': {
            pitch: 150,
            decay: 0.6,
            tone: 1.0,
            resonance: 8,
            stiffness: 1,
            strike: 0.002,
            damping: 0.8,
            spread: 1.03
        },
        'physical': {
            pitch: 120,
            decay: 0.8,
            material: 1,
            tension: 1,
            strike: 0.003,
            position: 0.35,
            resonance: 5,
            damping: 0.7
        },
        'additive': {
            pitch: 150,
            harmonics: 8,
            decay: 0.5,
            decaySpread: 1.5,
            evenOdd: 0.5,
            brightness: 1,
            attack: 0.001,
            shape: 1
        },
        'fm2': {
            pitch: 200,
            cRatio: 2,
            modIndex: 8,
            indexDecay: 0.15,
            feedback: 0.3,
            decay: 0.25,
            chaos: 0.2,
            attack: 0.001
        },
        'ks': {
            pitch: 110,
            decay: 0.8,
            brightness: 0.6,
            damping: 0.7,
            stretch: 1,
            exciter: 0.3,
            pickPos: 0.4,
            noise: 0.2
        },
        'buchla': {
            pitch: 180,
            decay: 0.4,
            tone: 1,
            metallic: 0.3,
            impact: 0.5,
            ring: 0.4,
            sweep: 0.5,
            noise: 0.2
        }
    };
    
    return defaults[engine] || defaults['808'];
}

export function getTrack(trackId) {
    return state.tracks[trackId];
}

export function setSelectedTrack(trackId) {
    state.selectedTrack = trackId;
}

export function getSelectedTrack() {
    return state.tracks[state.selectedTrack];
}

// Initialize default tracks
export function initializeTracks() {
    initializeTrack('kick', 'KICK', '808');
    initializeTrack('snare', 'SNARE', 'snare');
    initializeTrack('hihat', 'HI-HAT', 'noise');
    initializeTrack('tom', 'TOM', 'modal');
    initializeTrack('perc', 'PERC', 'fm');
    initializeTrack('cymbal', 'CYMBAL', 'noise');
}

// Save/Load state functions
export function saveCompleteState() {
    return {
        version: '1.0',
        tempo: state.tempo,
        currentPattern: state.currentPattern,
        masterFX: { ...state.masterFX },
        tracks: Object.fromEntries(
            Object.entries(state.tracks).map(([id, track]) => [
                id,
                {
                    name: track.name,
                    mute: track.mute,
                    engine: track.engine,
                    params: { ...track.params },
                    fx: { ...track.fx },
                    normalState: track.normalState ? {
                        engine: track.normalState.engine,
                        params: { ...track.normalState.params },
                        fx: { ...track.normalState.fx }
                    } : null,
                    morphAmount: track.morphAmount,
                    targetParams: track.targetParams
                }
            ])
        )
    };
}

export function loadCompleteState(data) {
    if (data.version !== '1.0') {
        throw new Error('Invalid state version');
    }
    
    state.tempo = data.tempo;
    state.currentPattern = data.currentPattern || 0;
    state.masterFX = { ...data.masterFX };
    
    Object.entries(data.tracks).forEach(([id, trackData]) => {
        const track = state.tracks[id];
        if (track) {
            track.mute = trackData.mute;
            track.engine = trackData.engine;
            track.params = { ...trackData.params };
            track.fx = { ...trackData.fx };
            track.normalState = trackData.normalState ? {
                engine: trackData.normalState.engine,
                params: { ...trackData.normalState.params },
                fx: { ...trackData.normalState.fx }
            } : null;
            track.morphAmount = trackData.morphAmount || 0;
            track.targetParams = trackData.targetParams || null;
        }
    });
}
