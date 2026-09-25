let audioContext = null 
let mainFilter = null 
let mainAnalyser = null

const WAVEFORM_GAINS = {
  sine: 0.6,       // Needs to be higher because it's a pure, quiet tone
  triangle: 0.6,   // Also relatively soft
  sawtooth: 0.4,  // Cut this way down—it's incredibly buzzy and loud
  square: 0.3     // Cut this down even more—it carries a lot of perceived energy
}

// The balancing mix levels for our dual oscillators
const SUB_GAIN = 0.5      // Strong, clean low-end punch
const GROWL_GAIN = 0.2    // Just enough buzzy sawtooth to hear the note on small speakers

// Instead of tracking a single oscillator, our engine will now create two independent sound sources (Sub and Growl), 
// connect them to their own tailored volume balances, and pack them neatly into the return object 
// so Vue can turn them both off at the exact same microsecond.


export const startNote = (frequency = 110, waveform = 'sine', filter = false) => {
  if (typeof frequency !== 'number' || isNaN(frequency)) {
    frequency = 110
  }

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }

  if (!mainFilter) {
    mainFilter = audioContext.createBiquadFilter()
    mainFilter.type = 'lowpass'
    mainFilter.frequency.setValueAtTime(350, audioContext.currentTime)
  }

  if (!mainAnalyser) {
    mainAnalyser = audioContext.createAnalyser()
    mainAnalyser.fftSize = 2048

    mainFilter.connect(mainAnalyser)
    mainAnalyser.connect(audioContext.destination)
  }

    // Create a single main master gain node to control the overall note envelope
  const masterGain = audioContext.createGain()

  // --- OSCILLATOR 1: The "Sub" (Always a pure Sine for clean, deep low-end) ---
  const subOsc = audioContext.createOscillator()
  const subGain = audioContext.createGain()
  subOsc.type = 'sine'
  subOsc.frequency.setValueAtTime(frequency, audioContext.currentTime)
  subGain.gain.setValueAtTime(SUB_GAIN, audioContext.currentTime)
  
  // --- OSCILLATOR 2: The "Growl" (Uses your UI selected waveform, e.g., Sawtooth) ---
  const growlOsc = audioContext.createOscillator()
  const growlGain = audioContext.createGain()
  growlOsc.type = waveform
  growlOsc.frequency.setValueAtTime(frequency, audioContext.currentTime)
  growlGain.gain.setValueAtTime(GROWL_GAIN, audioContext.currentTime)

  // A true bass synth needs a slightly slower "attack" to sound heavy and rich
  masterGain.gain.setValueAtTime(0, audioContext.currentTime)
  masterGain.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + 0.04) // 40ms attack

  // Wire up the audio graph:
  subOsc.connect(subGain)
  subGain.connect(masterGain)
  
  growlOsc.connect(growlGain)
  growlGain.connect(masterGain)

  masterGain.connect(mainFilter)

  // Start both engines simultaneously
  subOsc.start()
  growlOsc.start()

  // Return everything to Vue so we can clean up cleanly on mouseup
  return { subOsc, growlOsc, masterGain }
}

export const stopNote = (activeNote) => {
  if (!activeNote || !audioContext) return

  const { subOsc, growlOsc, masterGain } = activeNote

  // Give it a slightly longer, smoother release (120ms) so the bass slides away beautifully
  masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime)
  masterGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12)

  subOsc.stop(audioContext.currentTime + 0.12)
  growlOsc.stop(audioContext.currentTime + 0.12)
  
  setTimeout(() => {
    subOsc.disconnect()
    growlOsc.disconnect()
    masterGain.disconnect()
  }, 200)
}

export const setFilterFrequency = (value) => {
    if (!mainFilter || !audioContext) return 

    mainFilter.frequency.setValueAtTime(value, audioContext.currentTime)
}

export const getWaveData = () => {
    if (!mainAnalyser) return null

    const bufferLength = mainAnalyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength) 

    //populate the data - this method MUTATES the data 
    mainAnalyser.getByteTimeDomainData(dataArray)
    //return the now mutated data 
    return dataArray
}