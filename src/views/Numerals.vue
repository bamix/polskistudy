<template>
  <v-container class="py-6" style="max-width: 840px;">
    <v-card :elevation="2" rounded="lg" class="mb-4">
      <v-card-text>
        <div class="mb-4 d-flex flex-column align-center text-center">
          <div class="d-flex align-center justify-center" style="gap:.5rem;">
            <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium" style="letter-spacing:.5px;">Liczebnik</div>
          </div>
          <div class="text-h2 font-weight-bold mt-1 text-primary">
            {{ question.number }}
          </div>
          <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mt-4" style="letter-spacing:.5px;">Napisz słowami (mianownik)</div>
        </div>

        <v-text-field
          v-model="answer"
          label="Odpowiedź słowami"
          variant="outlined"
          density="comfortable"
          :disabled="result.checked && !disableActions" 
          ref="answerField"
          hide-details="auto"
          @keyup.enter="handleEnterKey"
          placeholder="np. dwieście trzydzieści jeden"
        />

        <div class="mt-4 d-flex flex-column">
          <v-btn block size="x-large" color="success" @click="submitAnswer" :prepend-icon="result.checked ? 'mdi-skip-next' : 'mdi-check'" :disabled="disableSubmit">
            {{ result.checked ? 'Dalej' : 'Wyślij' }}
          </v-btn>
          <v-btn block class="mt-2" variant="text" @click="skipQuestion" prepend-icon="mdi-skip-forward" :disabled="disableActions">Pomiń</v-btn>
        </div>

        <transition name="fade">
          <div v-if="result.checked" class="mt-5">
            <div v-if="result.isCorrect" class="text-caption text-medium-emphasis">(Automatycznie dalej)</div>
            <div v-else class="text-caption text-medium-emphasis text-center" :class="{ 'opacity-50': disableActions }">
              <span v-if="disableActions">(Odblokowanie za 2 s)</span>
              <span v-else>(Kliknij "Dalej" aby kontynuować)</span>
            </div>

            <v-alert :type="result.isCorrect ? 'success' : 'error'" variant="tonal" class="mb-2" :title="result.message">
              <template v-if="!result.isCorrect">
                <h1 class="text-center">{{ result.correctAnswer }}</h1>
              </template>
            </v-alert>
          </div>
        </transition>

        <div v-if="stats.total" class="mt-4 d-flex flex-column align-center text-center text-caption" style="opacity:.75;">
          <div><strong>{{ stats.correct }}</strong>/<span>{{ stats.total }}</span> ({{ accuracy }}%)</div>
          <div v-if="stats.skipped" class="mt-1">pominięte: {{ stats.skipped }}</div>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue'

const question = reactive({
  number: 0,
  correctAnswer: ''
})

const answer = ref('')
const answerField = ref(null)

// Helper to robustly focus the input
function focusAnswer(retries = 3) {
  nextTick(() => {
    if (answerField.value) {
      try {
        answerField.value.focus()
        if (retries > 0) setTimeout(() => focusAnswer(retries - 1), 60)
      } catch (_) {
        if (retries > 0) setTimeout(() => focusAnswer(retries - 1), 100)
      }
    } else if (retries > 0) {
      setTimeout(() => focusAnswer(retries - 1), 50)
    }
  })
}

const result = reactive({
  checked: false,
  isCorrect: false,
  message: '',
  correctAnswer: ''
})

// Session statistics
const stats = reactive({
  total: 0,
  correct: 0,
  skipped: 0,
})

const accuracy = computed(() => stats.total ? Math.round((stats.correct / stats.total) * 100) : 0)

// Disable buttons only during 2s lock after incorrect answer
const lockUntil = ref(0)
const disableActions = computed(() => Date.now() < lockUntil.value)
const disableSubmitEmpty = computed(() => !answer.value || !answer.value.trim())
const disableSubmit = computed(() => {
  const actionsDisabled = disableActions.value
  const emptyAndNotChecked = !result.checked && disableSubmitEmpty.value
  return actionsDisabled || emptyAndNotChecked
})

let nextTimer = null

// Polish numerals data
const numerals = {
  0: 'zero',
  1: 'jeden',
  2: 'dwa',
  3: 'trzy',
  4: 'cztery',
  5: 'pięć',
  6: 'sześć',
  7: 'siedem',
  8: 'osiem',
  9: 'dziewięć',
  10: 'dziesięć',
  11: 'jedenaście',
  12: 'dwanaście',
  13: 'trzynaście',
  14: 'czternaście',
  15: 'piętnaście',
  16: 'szesnaście',
  17: 'siedemnaście',
  18: 'osiemnaście',
  19: 'dziewiętnaście',
  20: 'dwadzieścia',
  30: 'trzydzieści',
  40: 'czterdzieści',
  50: 'pięćdziesiąt',
  60: 'sześćdziesiąt',
  70: 'siedemdziesiąt',
  80: 'osiemdziesiąt',
  90: 'dziewięćdziesiąt',
  100: 'sto',
  200: 'dwieście',
  300: 'trzysta',
  400: 'czterysta',
  500: 'pięćset',
  600: 'sześćset',
  700: 'siedemset',
  800: 'osiemset',
  900: 'dziewięćset',
  1000: 'tysiąc'
}

// Convert number to Polish words
function numberToWords(num) {
  if (num === 0) return 'zero'
  
  const result = []
  
  // Thousands
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000)
    if (thousands === 1) {
      result.push('tysiąc')
    } else if (thousands < 5) {
      result.push(numerals[thousands], 'tysiące')
    } else {
      result.push(numerals[thousands], 'tysięcy')
    }
    num %= 1000
  }
  
  // Hundreds
  if (num >= 100) {
    const hundreds = Math.floor(num / 100) * 100
    result.push(numerals[hundreds])
    num %= 100
  }
  
  // Tens and units
  if (num >= 20) {
    const tens = Math.floor(num / 10) * 10
    result.push(numerals[tens])
    num %= 10
  }
  
  // Units (or teens)
  if (num > 0) {
    result.push(numerals[num])
  }
  
  return result.join(' ')
}

// Normalize function
function normalize(s) {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

function makeQuestion() {
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }

  // Generate random number from 0 to 9999
  const number = Math.floor(Math.random() * 10000)
  
  question.number = number
  question.correctAnswer = numberToWords(number)

  // Reset UI state
  answer.value = ''
  result.checked = false
  result.isCorrect = false
  result.message = ''
  result.correctAnswer = ''
  focusAnswer()
}

function submitAnswer() {
  if (!result.checked && disableSubmitEmpty.value) return
  if (result.checked) {
    nextQuestion()
    return
  }

  // Normalize answers for comparison
  const userAnswer = normalize(answer.value)
  const correctAnswer = normalize(question.correctAnswer)
  const isCorrect = userAnswer === correctAnswer

  result.checked = true
  result.isCorrect = isCorrect

  if (isCorrect) {
    result.message = 'Dobrze!'
    result.correctAnswer = ''
  } else {
    result.message = 'Źle.'
    result.correctAnswer = question.correctAnswer
  }

  // Update stats
  stats.total++
  if (isCorrect) stats.correct++

  if (isCorrect) {
    nextTimer = setTimeout(() => nextQuestion(), 1500)
  } else {
    lockUntil.value = Date.now() + 2000
    nextTimer = setTimeout(() => { lockUntil.value = 0 }, 2000)
  }
}

function handleEnterKey() {
  if (result.checked && result.isCorrect) {
    if (nextTimer) {
      clearTimeout(nextTimer)
      nextTimer = null
    }
    nextQuestion()
    return
  }
  submitAnswer()
}

function skipQuestion() {
  stats.total++
  stats.skipped++
  nextQuestion()
}

function nextQuestion() {
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }
  lockUntil.value = 0
  makeQuestion()
}

onMounted(() => {
  makeQuestion()
})

onUnmounted(() => {
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>