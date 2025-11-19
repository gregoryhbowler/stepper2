// Karplus-Strong Audio Worklet Processor
// This runs in a separate audio thread for better performance

class KarplusStrongProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        const params = options.processorOptions;
        
        // Simple random noise generator
        this.random = (range) => Math.random() * 2 * range - range;
        
        // Parameters
        this.impulseDurationInSeconds = 0.0005; // 500 microseconds
        this.impulseDurationInSamples = Math.round(this.impulseDurationInSeconds * sampleRate);
        this.impulseCountdownInSamples = this.impulseDurationInSamples;
        
        // Delay buffer
        this.delaySizeInSamples = Math.round(sampleRate / params.pitch);
        this.delayBuffer = new Float32Array(this.delaySizeInSamples);
        this.delayBufferIndex = 0;
        
        // Feedback gain
        this.gain = 0.995 - (params.damping * 0.15);
        
        // Duration tracking
        this.maxDuration = params.decay;
        this.samplesProcessed = 0;
        this.maxSamples = Math.round(this.maxDuration * sampleRate);
        
        this.maxAmplitude = 1;
        this.isActive = true;
    }
    
    process(inputs, outputs, parameters) {
        if (!this.isActive) {
            return false; // Stop processing
        }
        
        const output = outputs[0];
        const outputChannel = output[0];
        
        for (let i = 0; i < outputChannel.length; i++) {
            // Check if we've exceeded duration
            if (this.samplesProcessed >= this.maxSamples) {
                this.isActive = false;
                outputChannel[i] = 0;
                continue;
            }
            
            // Generate noise only during initial burst
            const noiseSample = (--this.impulseCountdownInSamples >= 0) ? 
                this.random(this.maxAmplitude) : 0;
            
            // THE KEY KARPLUS-STRONG ALGORITHM:
            // Read from current and next position, average with gain, add noise, write to current
            this.delayBuffer[this.delayBufferIndex] = noiseSample + this.gain *
                (this.delayBuffer[this.delayBufferIndex] + 
                 this.delayBuffer[(this.delayBufferIndex + 1) % this.delaySizeInSamples]) / 2;
            
            // Output current sample
            outputChannel[i] = this.delayBuffer[this.delayBufferIndex];
            
            // Advance index
            if (++this.delayBufferIndex >= this.delaySizeInSamples) {
                this.delayBufferIndex = 0;
            }
            
            this.samplesProcessed++;
        }
        
        return this.isActive;
    }
}

registerProcessor('karplus-strong-processor', KarplusStrongProcessor);
