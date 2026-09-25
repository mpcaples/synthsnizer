<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { startNote, stopNote, setFilterFrequency, getWaveData } from './scripts/audioEngine.js'

const visualizerCanvas = ref(null)

const drawVisualizer = () => {
  requestAnimationFrame(drawVisualizer)
  const canvas = visualizerCanvas.value
  if (!canvas) return

  
  
  let data = getWaveData()
  const ctx = canvas.getContext('2d')
// 1. Create a gradient that spans from the left edge (0) to the right edge (canvas.width)
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, '#ff007f')   // Magenta/Pink (90s vibe)
  gradient.addColorStop(0.5, '#9d00ff') // Deep Purple
  gradient.addColorStop(1, '#00f0ff')   // Cyan/Bright Blue


  if (!data) {
    // Clear canvas and draw a steady line representing silence
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
    ctx.moveTo(0, canvas.height / 2)
    ctx.lineTo(canvas.width, canvas.height / 2)

    ctx.strokeStyle = gradient
    ctx.lineWidth = 2
    ctx.stroke()
    return // Exit early so it doesn't run the missing audio data loops
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height) 
  ctx.beginPath()
  let sliceWidth = canvas.width / data.length
  for (let i = 0; i < data.length; i++) {
    let x = i * sliceWidth
    let v = data[i] / 128.0
    let y = v * (canvas.height / 2)

    // draw 
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.lineWidth = 2
  ctx.strokeStyle = gradient

  // actually render to canvas 
  ctx.stroke()
}
  


// 12-Tone Chromatic Scale from C2 to C3 mapped to logical computer keys
// The 'offset' property helps position the black keys accurately over the white keys.
const CHROMATIC_SCALE = [
  { name: 'C2',  key: 'a', type: 'white', frequency: 65.41 },
  { name: 'C#2', key: 'w', type: 'black', frequency: 69.30,  offset: 42 },
  { name: 'D2',  key: 's', type: 'white', frequency: 73.42 },
  { name: 'D#2', key: 'e', type: 'black', frequency: 77.78,  offset: 106 },
  { name: 'E2',  key: 'd', type: 'white', frequency: 82.41 },
  { name: 'F2',  key: 'f', type: 'white', frequency: 87.31 },
  { name: 'F#2', key: 't', type: 'black', frequency: 92.50,  offset: 234 },
  { name: 'G2',  key: 'g', type: 'white', frequency: 98.00 },
  { name: 'G#2', key: 'y', type: 'black', frequency: 103.83, offset: 298 },
  { name: 'A2',  key: 'h', frequency: 110.00, type: 'white' },
  { name: 'A#2', key: 'u', type: 'black', frequency: 116.54, offset: 362 },
  { name: 'B2',  key: 'j', type: 'white', frequency: 123.47 },
  { name: 'C3',  key: 'k', type: 'white', frequency: 130.81 }
]

const waveTypes = [
  'sawtooth', 'sine', 'square', 'triangle' 
]

const cutoff = ref(350)
const waveType = ref('sine')


const setWaveType = (newWaveType) => {
  waveType.value = newWaveType
}

const updateFilter = () => {
  setFilterFrequency(cutoff.value)
}

// 2. A map to keep track of every currently running note instance by its key binding
// Using a reactive Map so Vue knows when to toggle the CSS '.active' class
const activeNotes = ref(new Map())

// 3. Audio Triggers
const playNote = (key, frequency) => {
  // Prevent duplicate notes firing repeatedly when a computer key is held down
  if (activeNotes.value.has(key)) return
  const noteInstance = startNote(frequency, waveType.value) // Start the audio engine
  if (!noteInstance) return
  activeNotes.value.set(key, noteInstance) // save the resulting audio nodes tracking object
}



const stopNoteByKey = (key) => {
  const noteInstance = activeNotes.value.get(key)
  if (noteInstance) {
    stopNote(noteInstance)
    activeNotes.value.delete(key)
  }
}

const handleKeyDown = (event) => {
  const lowercaseKey = event.key.toLowerCase()
  const matchedNote = CHROMATIC_SCALE.find(n => n.key === lowercaseKey)
  if (matchedNote) {
    playNote(matchedNote.key, matchedNote.frequency)
  }
}

const handleKeyUp = (event) => {
  const lowercaseKey = event.key.toLowerCase()
  stopNoteByKey(lowercaseKey)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  requestAnimationFrame(drawVisualizer)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<template>
  <div class="title-container">
    <h1 class="retro-90s-text">SynthSnizer</h1>
    <h2>Bass Edition</h2>
    <p>a web synth by trashhh only</p>
  </div>


 <div class="oscilloscope-container">
   <canvas class="oscilloscope-canvas" ref="visualizerCanvas" width="512" height="100"></canvas>
 </div>

  <div class="piano-container">    
    <!-- Controls Container for Waveforms -->
    <div class="controls-container">
      <button 
        v-for="wave in waveTypes" 
        :key="wave"
        :class="{ active: waveType === wave }"
        @click="setWaveType(wave)"
      >
        {{ wave.toUpperCase() }}
      </button>
      <input
        type="range"
        class="filter-slider"
        min="40"
        max="2000"
        v-model.number="cutoff"
        @input="updateFilter"
      >
    </div>

    <!-- The Piano Keyboard -->
    <div class="piano-keyboard">
      <div 
        v-for="note in CHROMATIC_SCALE" 
        :key="note.key"
        :class="[
          'piano-key', 
          note.type, 
          { active: activeNotes.has(note.key) }
        ]"
        :style="note.type === 'black' ? { left: note.offset + 'px' } : {}"
        @mousedown="playNote(note.key, note.frequency)"
        @mouseup="stopNoteByKey(note.key)"
        @mouseleave="stopNoteByKey(note.key)"
      >
        <span class="note-name">{{ note.name }}</span>
        <span class="key-bind">[{{ note.key.toUpperCase() }}]</span>
      </div>
    </div>
  </div>

</template>

<style scoped>
@font-face {
  font-family: 'Early Quake';
  src: url('./assets/fonts/early-quake-demo.regular.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}
.title-container {
  display: flex; 
  flex-direction: column;
  justify-content: center;
  align-items: center;  
  padding: 20px; 
}

.retro-90s-text {
  font-family: 'Early Quake', sans-serif;
  margin: 0; 
  /* High-saturation 90s neon purple to pink gradient */
  background: linear-gradient(90deg, #ec6e00 0%, #ff00e1 50%, #5500ff 100%);
  
  /* Clip the background to the text */
  -webkit-background-clip: text;
  background-clip: text;
  
  /* Make the underlying text color transparent so the gradient shows through */
  -webkit-text-fill-color: transparent;
  color: transparent;
  
  /* Optional: 90s aesthetic works best with bold, heavy fonts */
  text-transform: uppercase;
  font-size: 60px; 
    -webkit-text-stroke: 3px #000000; /* Matches the stroke width to prevent clipping */
}

/* 🖤 THE TRICK: The pseudo-element acts as a solid background shadow layer */
.retro-90s-text::after {
  content: "SYNTHSNIZER"; /* Pulls text dynamically from HTML */
  position: absolute;
  left: 124px;  /* Control horizontal shadow distance */
  top: 18px;   /* Control vertical shadow distance */
  z-index: -1; /* Pushes it strictly behind the gradient text */
  
  /* Create the chunky shadow appearance */
  -webkit-text-fill-color: #967ce3;
     -webkit-text-stroke: 3px #bfb0da;
}

.title-container h2, .title-container p {
  font-family:  'Early Quake', sans-serif;
}

.title-container h2 {
  font-size: 40px;
}

.oscilloscope-container {
  display: flex; 
  justify-content: center;
  align-items: center;
}

.oscilloscope-canvas{
  background-color: #222;
  border: 10px solid #ccc; 
  border-radius: 10px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
    0 10px 25px -5px rgba(0, 0, 0, 0.1);
}
.piano-container {
  font-family: sans-serif;
  text-align: center;
  padding: 20px;
  user-select: none;
}

.controls-container {
  margin-bottom: 25px;
}

.controls-container button {
  color: #4c3084;
  padding: 10px 15px;
  margin: 0 4px;
  border: 1px solid #967ce3;
  background: #dbfdff;
  cursor: pointer;
  border-radius: 4px;
}

.controls-container button.active {
  background: #4c3084;
  color: #decefc;
}

/* CSS Piano Layout */
.piano-keyboard {
  display: flex;
  position: relative;
  width: 512px; /* 8 white keys * 64px width */
  margin: 40px auto;
  height: 220px;
}

.piano-key {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  cursor: pointer;
}

.piano-key.white {
  color: #4c3084;
  width: 64px;
  height: 220px;
  background-color: #dbfdff;
  border: 1px solid #967ce3;
  border-radius: 0 0 6px 6px;
  padding: 20px 0 10px 0;
  z-index: 1;
}

.piano-key.white.active {
  background-color: #b3faff;
  height: 218px;
}

.piano-key.black {
  position: absolute;
  width: 40px;
  height: 130px;
  background-color: #4c3084 ;
  border: 1px solid #967ce3 ;
  border-radius: 0 0 4px 4px;
  color: #decefc;
  padding: 15px 0 10px 0;
  z-index: 2; /* Sits on top of white keys */
}

.piano-key.black .key-bind {
  color: #c6108d;
}

.piano-key.black.active {
  background-color: #35215c;
  height: 128px;
}

.note-name {
  font-weight: bold;
  font-size: 1rem;
}

.key-bind {
  font-size: 0.75rem;
  color: #c6108d;
}

input[type="range"].filter-slider {
  accent-color: #c6108d; 
}
</style>
