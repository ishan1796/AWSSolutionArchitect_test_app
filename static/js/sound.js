// Web Audio API Sound Synthesizer for Offline-First Sound Effects
class SoundEffectsManager {
    constructor() {
        this.enabled = localStorage.getItem('sound_enabled') !== 'false';
        this.audioCtx = null;
    }

    init() {
        if (!this.audioCtx) {
            // Lazy initialization to conform to browser autoplay policy
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('sound_enabled', this.enabled);
        return this.enabled;
    }

    createOscillator(type, freq, duration, gainStart, gainEnd) {
        if (!this.enabled) return;
        this.init();
        
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(gainStart, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(gainEnd, this.audioCtx.currentTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }

    playClick() {
        this.createOscillator('sine', 800, 0.05, 0.1, 0.01);
    }

    playCorrect() {
        if (!this.enabled) return;
        this.init();
        
        const now = this.audioCtx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 arpeggio
        
        notes.forEach((freq, index) => {
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + (index * 0.08));
            
            gainNode.gain.setValueAtTime(0.15, now + (index * 0.08));
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + (index * 0.08) + 0.2);
            
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            osc.start(now + (index * 0.08));
            osc.stop(now + (index * 0.08) + 0.25);
        });
    }

    playWrong() {
        if (!this.enabled) return;
        this.init();
        
        const now = this.audioCtx.currentTime;
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.linearRampToValueAtTime(80, now + 0.3);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(147, now);
        osc2.frequency.linearRampToValueAtTime(77, now + 0.3);
        
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
    }

    playSuccess() {
        if (!this.enabled) return;
        this.init();
        
        const now = this.audioCtx.currentTime;
        const chords = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 chord
        
        chords.forEach((freq) => {
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.6);
            
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            osc.start();
            osc.stop(now + 0.65);
        });
    }
}

const SoundEffects = new SoundEffectsManager();
