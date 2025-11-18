// Audio synthesis engine for drum machine

export class DrumSynthEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.trackGains = {};
        this.masterFXNodes = {};
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.7;
            this.masterGain.connect(this.audioContext.destination);
            
            // Create track gains
            const trackIds = ['kick', 'snare', 'hihat', 'tom', 'perc', 'cymbal'];
            trackIds.forEach(id => {
                const gain = this.audioContext.createGain();
                gain.gain.value = 1.0;
                gain.connect(this.masterGain);
                this.trackGains[id] = gain;
            });
            
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            throw error;
        }
    }
    
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
    
    // 808 Kick Synthesis
    create808Kick(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        // Main oscillator with pitch sweep
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        
        const oscGain = ctx.createGain();
        
        // Pitch envelope
        const startFreq = 150 * params.pitch;
        const endFreq = 40 * params.pitch;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + params.pitchDecay);
        
        // Amplitude envelope
        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(1, now + params.attack);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + params.decay);
        
        osc.connect(oscGain);
        
        // Sub oscillator
        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        const subGain = ctx.createGain();
        
        subOsc.frequency.setValueAtTime(startFreq * 0.5, now);
        subOsc.frequency.exponentialRampToValueAtTime(endFreq * 0.5, now + params.pitchDecay);
        
        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(params.sub, now + params.attack);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + params.decay);
        
        subOsc.connect(subGain);
        
        // Click
        let clickNode = null;
        if (params.click > 0) {
            const clickOsc = ctx.createOscillator();
            clickOsc.type = 'square';
            clickOsc.frequency.value = startFreq * 8;
            
            const clickGain = ctx.createGain();
            clickGain.gain.setValueAtTime(params.click, now);
            clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.005);
            
            clickOsc.connect(clickGain);
            clickNode = clickGain;
        }
        
        // Waveshaper for drive
        const shaper = ctx.createWaveShaper();
        shaper.curve = this.makeDistortionCurve(params.drive);
        
        // Connect signal chain
        const merger = ctx.createGain();
        oscGain.connect(merger);
        subGain.connect(merger);
        if (clickNode) clickNode.connect(merger);
        
        merger.connect(shaper);
        
        // Start oscillators
        osc.start(now);
        subOsc.start(now);
        if (clickNode) clickNode.children[0].start(now);
        
        // Stop oscillators
        const stopTime = now + params.decay + 0.1;
        osc.stop(stopTime);
        subOsc.stop(stopTime);
        if (clickNode) clickNode.children[0].stop(stopTime);
        
        return { output: shaper, stopTime };
    }
    
    // FM Synth
    createFMDrum(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        // Carrier
        const carrier = ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = params.pitch;
        
        // Modulator
        const modulator = ctx.createOscillator();
        modulator.type = 'sine';
        modulator.frequency.value = params.pitch * params.fmRatio;
        
        // FM amount (modulation index)
        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(params.fmAmount, now);
        modGain.gain.exponentialRampToValueAtTime(1, now + params.fmDecay);
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        
        // Amplitude envelope
        const ampEnv = ctx.createGain();
        ampEnv.gain.setValueAtTime(0, now);
        ampEnv.gain.linearRampToValueAtTime(1, now + params.attack);
        ampEnv.gain.exponentialRampToValueAtTime(0.001, now + params.decay);
        
        carrier.connect(ampEnv);
        
        // Optional filter
        let output = ampEnv;
        if (params.tone < 3) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 8000 * params.tone;
            filter.Q.value = params.filterQ;
            ampEnv.connect(filter);
            output = filter;
        }
        
        // Start
        carrier.start(now);
        modulator.start(now);
        
        // Stop
        const stopTime = now + params.decay + 0.1;
        carrier.stop(stopTime);
        modulator.stop(stopTime);
        
        return { output, stopTime };
    }
    
    // Snare (Hybrid)
    createSnare(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        // Tone component (FM)
        const toneCarrier = ctx.createOscillator();
        toneCarrier.type = 'sine';
        toneCarrier.frequency.value = params.pitch;
        
        const toneModulator = ctx.createOscillator();
        toneModulator.type = 'sine';
        toneModulator.frequency.value = params.pitch * params.fmRatio;
        
        const toneModGain = ctx.createGain();
        toneModGain.gain.setValueAtTime(params.fmAmount, now);
        toneModGain.gain.exponentialRampToValueAtTime(1, now + params.toneDecay);
        
        toneModulator.connect(toneModGain);
        toneModGain.connect(toneCarrier.frequency);
        
        const toneEnv = ctx.createGain();
        toneEnv.gain.setValueAtTime(0, now);
        toneEnv.gain.linearRampToValueAtTime(1 - params.noiseAmount, now + 0.001);
        toneEnv.gain.exponentialRampToValueAtTime(0.001, now + params.toneDecay);
        
        toneCarrier.connect(toneEnv);
        
        // Noise component
        const bufferSize = ctx.sampleRate * 0.5;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 3000 * params.tone;
        noiseFilter.Q.value = params.snap * 3;
        
        const noiseEnv = ctx.createGain();
        noiseEnv.gain.setValueAtTime(0, now);
        noiseEnv.gain.linearRampToValueAtTime(params.noiseAmount, now + 0.001);
        noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + params.noiseDecay);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);
        
        // Mix
        const mixer = ctx.createGain();
        toneEnv.connect(mixer);
        noiseEnv.connect(mixer);
        
        // Start
        toneCarrier.start(now);
        toneModulator.start(now);
        noise.start(now);
        
        // Stop
        const stopTime = now + Math.max(params.toneDecay, params.noiseDecay) + 0.1;
        toneCarrier.stop(stopTime);
        toneModulator.stop(stopTime);
        noise.stop(stopTime);
        
        return { output: mixer, stopTime };
    }
    
    // Noise
    createNoise(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        // Create noise buffer
        const bufferSize = ctx.sampleRate * 0.5;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            if (Math.random() < params.density) {
                noiseData[i] = Math.random() * 2 - 1;
            } else {
                noiseData[i] = 0;
            }
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        
        // Filter
        const filter = ctx.createBiquadFilter();
        const filterTypes = ['lowpass', 'highpass', 'bandpass'];
        filter.type = filterTypes[Math.floor(params.filterType)];
        filter.frequency.value = 4000 * params.tone;
        filter.Q.value = params.spread;
        
        // Envelope
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(1, now + params.attack);
        
        // Shape between linear and exponential
        if (params.shape > 1.5) {
            env.gain.exponentialRampToValueAtTime(0.001, now + params.decay);
        } else {
            env.gain.linearRampToValueAtTime(0, now + params.decay);
        }
        
        noise.connect(filter);
        filter.connect(env);
        
        // Start
        noise.start(now);
        
        // Stop
        const stopTime = now + params.decay + 0.1;
        noise.stop(stopTime);
        
        return { output: env, stopTime };
    }
    
    makeDistortionCurve(amount) {
        const samples = 256;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2 / samples) - 1;
            curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
        }
        
        return curve;
    }
    
    // Modal Resonator
    createModal(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        const mixer = ctx.createGain();
        const modes = 7;
        const modeRatios = [1, 2.14, 3, 3.89, 5.14, 6, 7];
        
        for (let i = 0; i < modes; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            
            const ratio = Math.pow(modeRatios[i] * params.stiffness, params.spread);
            osc.frequency.value = params.pitch * ratio;
            
            const env = ctx.createGain();
            const modeDecay = params.decay * Math.pow(params.damping, i * 0.3);
            const modeAmp = 1 / Math.pow(i + 1, 0.7);
            
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(modeAmp, now + params.strike);
            env.gain.exponentialRampToValueAtTime(0.001, now + modeDecay);
            
            osc.connect(env);
            env.connect(mixer);
            
            osc.start(now);
            osc.stop(now + modeDecay + 0.1);
        }
        
        // Optional filter
        let output = mixer;
        if (params.tone < 2.5) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 4000 * params.tone;
            filter.Q.value = params.resonance;
            mixer.connect(filter);
            output = filter;
        }
        
        return { output, stopTime: now + params.decay + 0.1 };
    }
    
    // Physical Model
    createPhysical(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        const mixer = ctx.createGain();
        const modes = 5;
        const modeRatios = [1.00, 2.14, 3.00, 3.89, 5.14];
        
        for (let i = 0; i < modes; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            
            const ratio = modeRatios[i] * params.material * params.tension;
            osc.frequency.value = params.pitch * ratio;
            
            // Strike position affects amplitude
            const positionFactor = Math.sin(i * Math.PI * params.position);
            const modeAmp = Math.abs(positionFactor) / (i + 1);
            
            const env = ctx.createGain();
            const modeDecay = params.decay / (1 + i * params.damping * 0.2);
            
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(modeAmp, now + params.strike);
            env.gain.exponentialRampToValueAtTime(0.001, now + modeDecay);
            
            osc.connect(env);
            env.connect(mixer);
            
            osc.start(now);
            osc.stop(now + modeDecay + 0.1);
        }
        
        // Body resonance
        if (params.resonance > 0) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = params.pitch * 8;
            filter.Q.value = params.resonance;
            mixer.connect(filter);
            
            return { output: filter, stopTime: now + params.decay + 0.1 };
        }
        
        return { output: mixer, stopTime: now + params.decay + 0.1 };
    }
    
    // Additive Synthesis
    createAdditive(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        const mixer = ctx.createGain();
        const harmonics = Math.floor(params.harmonics);
        
        for (let n = 1; n <= harmonics; n++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = params.pitch * n;
            
            // Amplitude calculation
            let amp = 1 / n;
            if (n % 2 === 0) {
                amp *= params.evenOdd;
            } else {
                amp *= (1 - params.evenOdd * 0.5);
            }
            amp *= Math.pow(params.brightness, (n - 1) * 0.3);
            
            const env = ctx.createGain();
            const harmonicDecay = params.decay * Math.pow(params.decaySpread, (n - 1) * 0.15);
            
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(amp, now + params.attack);
            
            if (params.shape > 1.5) {
                env.gain.exponentialRampToValueAtTime(0.001, now + harmonicDecay);
            } else {
                env.gain.linearRampToValueAtTime(0, now + harmonicDecay);
            }
            
            osc.connect(env);
            env.connect(mixer);
            
            osc.start(now);
            osc.stop(now + harmonicDecay + 0.1);
        }
        
        return { output: mixer, stopTime: now + params.decay * params.decaySpread + 0.1 };
    }
    
    // Abstract FM
    createFM2(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        const carrier = ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = params.pitch;
        
        const modulator = ctx.createOscillator();
        modulator.type = 'sine';
        modulator.frequency.value = params.pitch / params.cRatio;
        
        const modGain = ctx.createGain();
        const modAmount = params.modIndex * (params.pitch / params.cRatio);
        modGain.gain.setValueAtTime(modAmount, now);
        modGain.gain.exponentialRampToValueAtTime(1, now + params.indexDecay);
        
        // Feedback path with waveshaper
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = params.feedback;
        
        const feedbackShaper = ctx.createWaveShaper();
        const fbCurve = new Float32Array(256);
        const fbAmount = 1 + params.feedback * 3;
        for (let i = 0; i < 256; i++) {
            const x = (i * 2 / 256) - 1;
            fbCurve[i] = Math.tanh(x * fbAmount);
        }
        feedbackShaper.curve = fbCurve;
        
        const feedbackDelay = ctx.createDelay();
        feedbackDelay.delayTime.value = 1 / params.pitch;
        
        // Connect feedback
        carrier.connect(feedbackDelay);
        feedbackDelay.connect(feedbackGain);
        feedbackGain.connect(feedbackShaper);
        feedbackShaper.connect(modulator.frequency);
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        
        // Chaos modulation
        if (params.chaos > 0) {
            for (let i = 0; i < 3; i++) {
                const chaosOsc = ctx.createOscillator();
                chaosOsc.type = 'sine';
                chaosOsc.frequency.value = 10 + Math.random() * 40;
                
                const chaosGain = ctx.createGain();
                chaosGain.gain.value = params.chaos * params.pitch * 0.1;
                
                chaosOsc.connect(chaosGain);
                chaosGain.connect(carrier.frequency);
                
                chaosOsc.start(now);
                chaosOsc.stop(now + params.decay + 0.1);
            }
        }
        
        const ampEnv = ctx.createGain();
        ampEnv.gain.setValueAtTime(0, now);
        ampEnv.gain.linearRampToValueAtTime(1, now + params.attack);
        ampEnv.gain.exponentialRampToValueAtTime(0.001, now + params.decay);
        
        carrier.connect(ampEnv);
        
        carrier.start(now);
        modulator.start(now);
        
        const stopTime = now + params.decay + 0.1;
        carrier.stop(stopTime);
        modulator.stop(stopTime);
        
        return { output: ampEnv, stopTime };
    }
    
    // Karplus-Strong
    createKS(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        // Create excitation
        const bufferSize = ctx.sampleRate * 0.1;
        const excitationBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = excitationBuffer.getChannelData(0);
        
        // Mix of impulse and noise
        for (let i = 0; i < bufferSize; i++) {
            const impulse = i < 10 ? (1 - params.exciter) : 0;
            const noise = (Math.random() * 2 - 1) * params.exciter;
            data[i] = impulse + noise;
        }
        
        const excitation = ctx.createBufferSource();
        excitation.buffer = excitationBuffer;
        
        // Delay line (string)
        const delayTime = (1 / params.pitch) * params.stretch;
        const delay = ctx.createDelay(2);
        delay.delayTime.value = delayTime;
        
        // Feedback with damping filter
        const feedback = ctx.createGain();
        feedback.gain.value = 0.98;
        
        const damping = ctx.createBiquadFilter();
        damping.type = 'lowpass';
        damping.frequency.value = params.pitch * (2 + params.brightness * 8);
        damping.Q.value = 1;
        
        // Pick position (comb filter effect)
        const pickFilter = ctx.createBiquadFilter();
        pickFilter.type = 'allpass';
        pickFilter.frequency.value = params.pitch / params.pickPos;
        
        // Connect delay loop
        excitation.connect(delay);
        delay.connect(damping);
        damping.connect(feedback);
        feedback.connect(pickFilter);
        pickFilter.connect(delay);
        
        // Output with envelope
        const env = ctx.createGain();
        env.gain.setValueAtTime(1, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + params.decay);
        
        delay.connect(env);
        
        // Additional noise
        if (params.noise > 0) {
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * params.decay, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * params.noise * 0.1;
            }
            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            noiseSource.connect(env);
            noiseSource.start(now);
        }
        
        excitation.start(now);
        
        return { output: env, stopTime: now + params.decay + 0.1 };
    }
    
    // Buchla Bongo
    createBuchla(params, startTime, duration) {
        const ctx = this.audioContext;
        const now = startTime || ctx.currentTime;
        
        const mixer = ctx.createGain();
        
        // Main tone with sweep
        const mainOsc = ctx.createOscillator();
        mainOsc.type = 'sine';
        mainOsc.frequency.setValueAtTime(params.pitch * (1 + params.sweep * 2), now);
        mainOsc.frequency.exponentialRampToValueAtTime(params.pitch, now + params.decay * 0.3);
        
        const mainEnv = ctx.createGain();
        mainEnv.gain.setValueAtTime(0, now);
        mainEnv.gain.linearRampToValueAtTime(params.tone, now + 0.001);
        mainEnv.gain.exponentialRampToValueAtTime(0.001, now + params.decay);
        
        mainOsc.connect(mainEnv);
        mainEnv.connect(mixer);
        
        // Metallic modes
        const metallicRatios = [1, 2.14, 3.05, 4.18, 5.43];
        metallicRatios.forEach((ratio, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = params.pitch * ratio;
            
            const env = ctx.createGain();
            const amp = params.metallic / (i + 2);
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(amp, now + 0.001);
            env.gain.exponentialRampToValueAtTime(0.001, now + params.decay * 0.7);
            
            osc.connect(env);
            env.connect(mixer);
            
            osc.start(now);
            osc.stop(now + params.decay + 0.1);
        });
        
        // Ring modulation
        if (params.ring > 0) {
            const ring1 = ctx.createOscillator();
            const ring2 = ctx.createOscillator();
            ring1.frequency.value = params.pitch * 1.4;
            ring2.frequency.value = params.pitch * 2.1;
            
            const ringGain = ctx.createGain();
            ringGain.gain.setValueAtTime(0, now);
            ringGain.gain.linearRampToValueAtTime(params.ring * 0.3, now + 0.001);
            ringGain.gain.exponentialRampToValueAtTime(0.001, now + params.decay * 0.5);
            
            ring1.connect(ringGain);
            ring2.connect(ringGain);
            ringGain.connect(mixer);
            
            ring1.start(now);
            ring2.start(now);
            ring1.stop(now + params.decay + 0.1);
            ring2.stop(now + params.decay + 0.1);
        }
        
        // Impact noise
        if (params.impact > 0) {
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            
            const impactFilter = ctx.createBiquadFilter();
            impactFilter.type = 'bandpass';
            impactFilter.frequency.value = params.pitch * 4;
            impactFilter.Q.value = 5;
            
            const impactEnv = ctx.createGain();
            impactEnv.gain.setValueAtTime(params.impact, now);
            impactEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            
            noise.connect(impactFilter);
            impactFilter.connect(impactEnv);
            impactEnv.connect(mixer);
            
            noise.start(now);
        }
        
        mainOsc.start(now);
        mainOsc.stop(now + params.decay + 0.1);
        
        return { output: mixer, stopTime: now + params.decay + 0.1 };
    }
    
    // Main playback method
    async playDrum(trackId, engine, params, fx, velocity) {
        await this.ensureInitialized();
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        // Create sound based on engine
        let voice;
        switch (engine) {
            case '808':
                voice = this.create808Kick(params, now);
                break;
            case 'fm':
                voice = this.createFMDrum(params, now);
                break;
            case 'snare':
                voice = this.createSnare(params, now);
                break;
            case 'noise':
                voice = this.createNoise(params, now);
                break;
            case 'modal':
                voice = this.createModal(params, now);
                break;
            case 'physical':
                voice = this.createPhysical(params, now);
                break;
            case 'additive':
                voice = this.createAdditive(params, now);
                break;
            case 'fm2':
                voice = this.createFM2(params, now);
                break;
            case 'ks':
                voice = this.createKS(params, now);
                break;
            case 'buchla':
                voice = this.createBuchla(params, now);
                break;
            default:
                voice = this.create808Kick(params, now);
        }
        
        // Apply FX chain
        let output = voice.output;
        output = this.applyFX(output, fx, now, voice.stopTime - now);
        
        // Apply velocity
        const velocityGain = ctx.createGain();
        velocityGain.gain.value = velocity;
        output.connect(velocityGain);
        
        // Connect to track output
        velocityGain.connect(this.trackGains[trackId]);
    }
    
    // FX Chain
    applyFX(input, fx, startTime, duration) {
        const ctx = this.audioContext;
        let output = input;
        
        // 1. Wasp Filter
        if (fx.waspFilter > 0) {
            const dry = ctx.createGain();
            dry.gain.value = 1 - fx.waspFilter;
            
            const wet = ctx.createGain();
            wet.gain.value = fx.waspFilter;
            
            // Pre-drive
            const preShaper = ctx.createWaveShaper();
            preShaper.curve = this.makeDistortionCurve(fx.waspDrive * 0.9);
            
            // Four cascaded lowpass filters
            let waspChain = preShaper;
            for (let i = 0; i < 4; i++) {
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = fx.waspFreq;
                filter.Q.value = fx.waspRes / 4;
                waspChain.connect(filter);
                waspChain = filter;
            }
            
            waspChain.connect(wet);
            
            input.connect(preShaper);
            input.connect(dry);
            
            const mixer = ctx.createGain();
            dry.connect(mixer);
            wet.connect(mixer);
            output = mixer;
        }
        
        // 2. Drive
        if (fx.drive > 1) {
            const driveShaper = ctx.createWaveShaper();
            driveShaper.curve = this.makeDistortionCurve(fx.drive);
            output.connect(driveShaper);
            output = driveShaper;
        }
        
        // 3. Distortion
        if (fx.distortion > 0) {
            const distShaper = ctx.createWaveShaper();
            const amount = fx.distortion * 50;
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i * 2 / 256) - 1;
                const ex = Math.exp(amount * x);
                const eMx = Math.exp(-amount * x);
                curve[i] = (ex - eMx) / (ex + eMx);
            }
            distShaper.curve = curve;
            
            const compensation = ctx.createGain();
            compensation.gain.value = 1 / (1 + fx.distortion);
            
            output.connect(distShaper);
            distShaper.connect(compensation);
            output = compensation;
        }
        
        // 4. Resonator
        if (fx.resonator > 0) {
            const dry = ctx.createGain();
            dry.gain.value = 1 - fx.resonator * 0.3;
            
            const wet = ctx.createGain();
            wet.gain.value = fx.resonator * 0.7;
            
            const resDelay = ctx.createDelay(2);
            resDelay.delayTime.value = 1 / fx.resFreq;
            
            const resFilter = ctx.createBiquadFilter();
            resFilter.type = 'bandpass';
            resFilter.frequency.value = fx.resFreq;
            resFilter.Q.value = 20;
            
            const resFeedback = ctx.createGain();
            resFeedback.gain.value = 0.85 * fx.resonator;
            
            output.connect(resDelay);
            resDelay.connect(resFilter);
            resFilter.connect(resFeedback);
            resFeedback.connect(resDelay);
            resFilter.connect(wet);
            
            output.connect(dry);
            
            const mixer = ctx.createGain();
            dry.connect(mixer);
            wet.connect(mixer);
            output = mixer;
        }
        
        // 5. Delay
        if (fx.delay > 0) {
            const dry = ctx.createGain();
            dry.gain.value = 1;
            
            const wet = ctx.createGain();
            wet.gain.value = fx.delay * 0.5;
            
            const delayNode = ctx.createDelay(2);
            delayNode.delayTime.value = fx.delayTime;
            
            const delayFeedback = ctx.createGain();
            delayFeedback.gain.value = 0.4 * fx.delay;
            
            output.connect(delayNode);
            delayNode.connect(delayFeedback);
            delayFeedback.connect(delayNode);
            delayNode.connect(wet);
            
            output.connect(dry);
            
            const mixer = ctx.createGain();
            dry.connect(mixer);
            wet.connect(mixer);
            output = mixer;
        }
        
        // 6. Reverb
        if (fx.reverb > 0) {
            const dry = ctx.createGain();
            dry.gain.value = 1;
            
            const wet = ctx.createGain();
            wet.gain.value = fx.reverb * 0.4;
            
            // Generate impulse response
            const sampleRate = ctx.sampleRate;
            const length = sampleRate * fx.reverbSize;
            const impulse = ctx.createBuffer(2, length, sampleRate);
            
            for (let channel = 0; channel < 2; channel++) {
                const data = impulse.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
                }
            }
            
            const convolver = ctx.createConvolver();
            convolver.buffer = impulse;
            
            output.connect(convolver);
            convolver.connect(wet);
            
            output.connect(dry);
            
            const mixer = ctx.createGain();
            dry.connect(mixer);
            wet.connect(mixer);
            output = mixer;
        }
        
        return output;
    }
}

// Engine parameter specifications
export const ENGINE_SPECS = {
    '808': {
        name: '808 Kick',
        params: {
            pitch: { label: 'Pitch', min: 0.2, max: 3, step: 0.01, default: 1 },
            pitchDecay: { label: 'Pitch Decay', min: 0.01, max: 0.3, step: 0.001, default: 0.05 },
            decay: { label: 'Decay', min: 0.05, max: 2, step: 0.01, default: 0.5 },
            punch: { label: 'Punch', min: 0, max: 3, step: 0.01, default: 1 },
            drive: { label: 'Drive', min: 1, max: 10, step: 0.1, default: 1 },
            sub: { label: 'Sub', min: 0, max: 1, step: 0.01, default: 0.3 },
            click: { label: 'Click', min: 0, max: 1, step: 0.01, default: 0 },
            attack: { label: 'Attack', min: 0.001, max: 0.05, step: 0.001, default: 0.001 }
        }
    },
    'fm': {
        name: 'FM Synth',
        params: {
            pitch: { label: 'Pitch', min: 40, max: 1200, step: 1, default: 200 },
            fmRatio: { label: 'FM Ratio', min: 0.25, max: 12, step: 0.01, default: 1.6 },
            fmAmount: { label: 'FM Amount', min: 0, max: 800, step: 1, default: 180 },
            fmDecay: { label: 'FM Decay', min: 0.01, max: 0.5, step: 0.01, default: 0.15 },
            decay: { label: 'Decay', min: 0.01, max: 1.5, step: 0.01, default: 0.15 },
            tone: { label: 'Tone', min: 0, max: 3, step: 0.01, default: 0.8 },
            filterQ: { label: 'Filter Q', min: 0, max: 20, step: 0.1, default: 1 },
            attack: { label: 'Attack', min: 0.001, max: 0.1, step: 0.001, default: 0.001 }
        }
    },
    'snare': {
        name: 'Snare',
        params: {
            pitch: { label: 'Pitch', min: 80, max: 400, step: 1, default: 200 },
            fmRatio: { label: 'FM Ratio', min: 0.5, max: 8, step: 0.01, default: 1.6 },
            fmAmount: { label: 'FM Amount', min: 0, max: 500, step: 1, default: 180 },
            toneDecay: { label: 'Tone Decay', min: 0.01, max: 0.5, step: 0.01, default: 0.08 },
            noiseAmount: { label: 'Noise', min: 0, max: 1, step: 0.01, default: 0.65 },
            noiseDecay: { label: 'Noise Decay', min: 0.01, max: 0.5, step: 0.01, default: 0.12 },
            snap: { label: 'Snap', min: 0, max: 3, step: 0.01, default: 1.5 },
            tone: { label: 'Tone', min: 0, max: 3, step: 0.01, default: 1.2 }
        }
    },
    'noise': {
        name: 'Noise',
        params: {
            tone: { label: 'Frequency', min: 0.2, max: 4, step: 0.01, default: 1.8 },
            spread: { label: 'Resonance', min: 0, max: 25, step: 0.1, default: 12 },
            decay: { label: 'Decay', min: 0.005, max: 2, step: 0.005, default: 0.04 },
            attack: { label: 'Attack', min: 0, max: 0.05, step: 0.001, default: 0.001 },
            shape: { label: 'Curve', min: 0.3, max: 3, step: 0.01, default: 1 },
            density: { label: 'Density', min: 0, max: 1, step: 0.01, default: 1 },
            filterType: { label: 'Filter', min: 0, max: 2, step: 1, default: 1 }
        }
    },
    'modal': {
        name: 'Modal',
        params: {
            pitch: { label: 'Pitch', min: 40, max: 500, step: 1, default: 150 },
            decay: { label: 'Decay', min: 0.1, max: 3, step: 0.01, default: 0.6 },
            tone: { label: 'Tone', min: 0, max: 2.5, step: 0.01, default: 1.0 },
            resonance: { label: 'Resonance', min: 0, max: 20, step: 0.1, default: 8 },
            stiffness: { label: 'Stiffness', min: 0.5, max: 3, step: 0.01, default: 1 },
            strike: { label: 'Strike', min: 0, max: 0.05, step: 0.001, default: 0.002 },
            damping: { label: 'Damping', min: 0, max: 2, step: 0.01, default: 0.8 },
            spread: { label: 'Spread', min: 0.9, max: 1.15, step: 0.001, default: 1.03 }
        }
    },
    'physical': {
        name: 'Physical Model',
        params: {
            pitch: { label: 'Pitch', min: 40, max: 400, step: 1, default: 120 },
            decay: { label: 'Decay', min: 0.1, max: 4, step: 0.01, default: 0.8 },
            material: { label: 'Material', min: 0.3, max: 2, step: 0.01, default: 1 },
            tension: { label: 'Tension', min: 0, max: 2, step: 0.01, default: 1 },
            strike: { label: 'Strike', min: 0, max: 0.08, step: 0.001, default: 0.003 },
            position: { label: 'Position', min: 0, max: 0.9, step: 0.01, default: 0.35 },
            resonance: { label: 'Resonance', min: 0, max: 15, step: 0.1, default: 5 },
            damping: { label: 'Damping', min: 0, max: 2, step: 0.01, default: 0.7 }
        }
    },
    'additive': {
        name: 'Additive',
        params: {
            pitch: { label: 'Pitch', min: 40, max: 800, step: 1, default: 150 },
            harmonics: { label: 'Harmonics', min: 2, max: 16, step: 1, default: 8 },
            decay: { label: 'Decay', min: 0.05, max: 3, step: 0.01, default: 0.5 },
            decaySpread: { label: 'Decay Spread', min: 0.5, max: 3, step: 0.01, default: 1.5 },
            evenOdd: { label: 'Even/Odd', min: 0, max: 1, step: 0.01, default: 0.5 },
            brightness: { label: 'Brightness', min: 0.1, max: 3, step: 0.01, default: 1 },
            attack: { label: 'Attack', min: 0, max: 0.05, step: 0.001, default: 0.001 },
            shape: { label: 'Shape', min: 0.3, max: 3, step: 0.01, default: 1 }
        }
    },
    'fm2': {
        name: 'Abstract FM',
        params: {
            pitch: { label: 'Pitch', min: 40, max: 2000, step: 1, default: 200 },
            cRatio: { label: 'C Ratio', min: 0.125, max: 16, step: 0.01, default: 2 },
            modIndex: { label: 'Mod Index', min: 0, max: 20, step: 0.1, default: 8 },
            indexDecay: { label: 'Index Decay', min: 0.01, max: 1, step: 0.01, default: 0.15 },
            feedback: { label: 'Feedback', min: 0, max: 0.95, step: 0.01, default: 0.3 },
            decay: { label: 'Decay', min: 0.01, max: 2, step: 0.01, default: 0.25 },
            chaos: { label: 'Chaos', min: 0, max: 1, step: 0.01, default: 0.2 },
            attack: { label: 'Attack', min: 0, max: 0.1, step: 0.001, default: 0.001 }
        }
    },
    'ks': {
        name: 'Karplus-Strong',
        params: {
            pitch: { label: 'Pitch', min: 40, max: 800, step: 1, default: 110 },
            decay: { label: 'Decay', min: 0.1, max: 5, step: 0.01, default: 0.8 },
            brightness: { label: 'Brightness', min: 0.1, max: 1, step: 0.01, default: 0.6 },
            damping: { label: 'Damping', min: 0, max: 0.99, step: 0.01, default: 0.7 },
            stretch: { label: 'Stretch', min: 0.95, max: 1.05, step: 0.001, default: 1 },
            exciter: { label: 'Exciter', min: 0, max: 1, step: 0.01, default: 0.3 },
            pickPos: { label: 'Pick Pos', min: 0.1, max: 0.9, step: 0.01, default: 0.4 },
            noise: { label: 'Noise', min: 0, max: 1, step: 0.01, default: 0.2 }
        }
    },
    'buchla': {
        name: 'Buchla Bongo',
        params: {
            pitch: { label: 'Pitch', min: 60, max: 400, step: 1, default: 180 },
            decay: { label: 'Decay', min: 0.05, max: 2, step: 0.01, default: 0.4 },
            tone: { label: 'Tone', min: 0.2, max: 3, step: 0.01, default: 1 },
            metallic: { label: 'Metallic', min: 0, max: 1, step: 0.01, default: 0.3 },
            impact: { label: 'Impact', min: 0, max: 1, step: 0.01, default: 0.5 },
            ring: { label: 'Ring', min: 0, max: 1, step: 0.01, default: 0.4 },
            sweep: { label: 'Sweep', min: 0, max: 2, step: 0.01, default: 0.5 },
            noise: { label: 'Noise', min: 0, max: 1, step: 0.01, default: 0.2 }
        }
    }
};

export const FX_SPECS = {
    waspFilter: { label: 'Wasp Mix', min: 0, max: 1, step: 0.01, default: 0 },
    waspFreq: { label: 'Wasp Freq', min: 100, max: 8000, step: 10, default: 2000 },
    waspRes: { label: 'Wasp Res', min: 0.5, max: 30, step: 0.1, default: 5 },
    waspDrive: { label: 'Wasp Drive', min: 1, max: 10, step: 0.1, default: 2 },
    drive: { label: 'Drive', min: 1, max: 20, step: 0.1, default: 1 },
    distortion: { label: 'Distortion', min: 0, max: 1, step: 0.01, default: 0 },
    resonator: { label: 'Resonator', min: 0, max: 1, step: 0.01, default: 0 },
    resFreq: { label: 'Res Freq', min: 100, max: 2000, step: 10, default: 440 },
    resDecay: { label: 'Res Decay', min: 0.05, max: 2, step: 0.01, default: 0.3 },
    delay: { label: 'Delay', min: 0, max: 1, step: 0.01, default: 0 },
    delayTime: { label: 'Delay Time', min: 0.05, max: 1, step: 0.01, default: 0.25 },
    reverb: { label: 'Reverb', min: 0, max: 1, step: 0.01, default: 0 },
    reverbSize: { label: 'Reverb Size', min: 0.5, max: 4, step: 0.1, default: 2 }
};
