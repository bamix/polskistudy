<template>
  <v-container class="py-6" style="max-width: 840px;">
    <v-card :elevation="2" rounded="lg" class="mb-4">
      <v-card-text>
        <div class="mb-2 d-flex align-center" style="gap:.75rem;">
          <v-btn size="small" variant="text" @click="showFilters = !showFilters" :prepend-icon="showFilters ? 'mdi-chevron-up' : 'mdi-filter-variant'">
            {{ showFilters ? 'Ukryj filtry' : 'Filtry' }}
          </v-btn>
          <div v-if="!showFilters" class="text-caption text-medium-emphasis">
            <span>Kategorie:
              <strong>
                {{ activeCategories.length ? activeCategories.join(', ') : 'wszystkie' }}
              </strong>
            </span>
          </div>
        </div>
        <v-expand-transition>
          <div v-if="showFilters" class="mb-4 d-flex flex-column flex-sm-row align-start align-sm-center" style="gap:1rem;">
            <div class="d-flex flex-column" style="min-width:200px;">
              <span class="text-caption text-medium-emphasis mb-1">Kategorie</span>
              <v-chip-group v-model="activeCategories" multiple column density="comfortable" class="flex-wrap" selected-class="bg-primary text-white">
                <v-chip v-for="cat in allCategories" :key="cat" :value="cat" variant="outlined" size="small">{{ cat }}</v-chip>
              </v-chip-group>
              <div v-if="!activeCategories.length" class="text-caption text-disabled mt-1">(wszystkie kategorie)</div>
            </div>
          </div>
        </v-expand-transition>
        <div class="mb-4 d-flex flex-column align-center text-center">
          <div class="d-flex align-center justify-center" style="gap:.5rem;">
            <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium" style="letter-spacing:.5px;">Tłumaczenie na rosyjski</div>
          </div>
          <div class="text-h4 font-weight-bold mt-3 d-flex flex-row flex-wrap align-center justify-center" style="line-height:1.15; gap:.5rem;">
            <span class="text-primary">{{ question.russian }}</span>
          </div>
          <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mt-4" style="letter-spacing:.5px;">Wpisz słowo po polsku</div>
        </div>

        <v-text-field
          v-model="answer"
          label="Odpowiedź"
          variant="outlined"
          density="comfortable"
          :disabled="result.checked && !disableActions" 
          ref="answerField"
          hide-details="auto"
          @keyup.enter="handleEnterKey"
          placeholder="wpisz słowo"
        />

        <div class="mt-4 d-flex flex-column">
          <v-btn block size="x-large" color="success" @click="submitAnswer" :prepend-icon="result.checked ? 'mdi-skip-next' : 'mdi-check'" :disabled="disableSubmit">
            {{ result.checked ? 'Dalej' : 'Wyślij' }}
          </v-btn>
          <v-btn block class="mt-2" variant="text" @click="skipQuestion" prepend-icon="mdi-skip-forward" :disabled="result.checked">Pomiń</v-btn>
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
import { ref, reactive, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'

const question = reactive({
  russian: '',
  polish: '',
  category: ''
})

const answer = ref('')
const answerField = ref(null)
const allWords = ref([])
const allCategories = ref([])
const remainingWords = ref([])

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

// Filters
const activeCategories = ref([])
const showFilters = ref(false)

// Watch for changes in filters and save to localStorage
watch(
  activeCategories,
  (newCategories) => {
    localStorage.setItem('polskiStudyVocabularyFilters', JSON.stringify({ categories: newCategories }))
  },
  { deep: true }
)

// Get filtered words
const filteredWords = computed(() => {
  if (!activeCategories.value.length) {
    return allWords.value
  }
  return allWords.value.filter(w => activeCategories.value.includes(w.category))
})

// Load data and initialize
async function loadData() {
  try {
    const response = await fetch('/vocabulary.json')
    const data = await response.json()
    allWords.value = data.words
    allCategories.value = data.categories

    // Restore filters from localStorage
    const saved = localStorage.getItem('polskiStudyVocabularyFilters')
    if (saved) {
      const { categories } = JSON.parse(saved)
      activeCategories.value = categories
    }

    // Pick first word
    nextQuestion()
  } catch (error) {
    console.error('Failed to load vocabulary data:', error)
  }
}

function nextQuestion() {
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }
  lockUntil.value = 0

  // Initialize remaining words if empty
  if (remainingWords.value.length === 0) {
    remainingWords.value = [...filteredWords.value]
  }

  if (!remainingWords.value.length) return

  const randomIndex = Math.floor(Math.random() * remainingWords.value.length)
  const randomWord = remainingWords.value[randomIndex]
  
  // Remove selected word from remaining
  remainingWords.value.splice(randomIndex, 1)
  
  question.russian = randomWord.russian
  question.polish = randomWord.polish
  question.category = randomWord.category

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
    // Если ответ неправильный и таймер ещё работает, не переходим
    if (!result.isCorrect && disableActions.value) {
      return
    }
    nextQuestion()
    return
  }

  const userAnswer = answer.value.trim().toLowerCase().replace(/\s+/g, ' ')
  const correctAnswer = question.polish.toLowerCase()

  const isCorrect = userAnswer === correctAnswer

  result.checked = true
  result.isCorrect = isCorrect

  if (isCorrect) {
    result.message = 'Prawidłowo!'
    result.correctAnswer = ''
  } else {
    result.message = 'Źle.'
    result.correctAnswer = question.polish
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

function skipQuestion() {
  stats.skipped++
  stats.total++
  nextQuestion()
}

function handleEnterKey(event) {
  // Если уже проверено и ответ правильный — сразу следующий вопрос
  if (result.checked && result.isCorrect) {
    if (nextTimer) {
      clearTimeout(nextTimer)
      nextTimer = null
    }
    nextQuestion()
    if (event) event.preventDefault()
    return
  }
  // Если уже проверено и ответ неправильный, но таймер разблокировки истёк — перейти
  if (result.checked && !result.isCorrect && !disableActions.value) {
    if (nextTimer) {
      clearTimeout(nextTimer)
      nextTimer = null
    }
    nextQuestion()
    if (event) event.preventDefault()
    return
  }
  // В остальных случаях — обычная отправка
  submitAnswer()
}

function handleGlobalKeydown(event) {
  if (event.key === 'Enter') {
    handleEnterKey(event);
  }
}

// Watch for filter changes and regenerate question
watch(filteredWords, () => {
  remainingWords.value = []
  nextQuestion()
})


onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  loadData()
})


onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
