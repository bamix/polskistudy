<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'

const loading = ref(true)
const error = ref(null)
const data = reactive({ adjectives: [], nouns: [], cases: [] })

const question = reactive({
  baseAdj: '',
  baseNoun: '',
  targetCase: 'nom',
  targetNumber: 'sg',
  correctAdj: '',
  correctNoun: '',
  correct: '',
  gender: 'm', // gender of the noun
  isRepeat: false, // flag to indicate if this is a repeated question
})

const answer = ref('')
const answerField = ref(null)
// Helper to robustly focus the input (especially on mobile, after transitions)
function focusAnswer(retries = 3) {
  nextTick(() => {
    if (answerField.value) {
      try {
        answerField.value.focus()
        // If value is empty ensure cursor visible; some mobile browsers need a slight delay
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

// Incorrect questions storage
const incorrectQuestions = ref([])
const REPEAT_PROBABILITY = 0.3 // 30% chance to repeat incorrect question
const MAX_INCORRECT_STORE = 20 // Maximum number of incorrect questions to store

const accuracy = computed(() => stats.total ? Math.round((stats.correct / stats.total) * 100) : 0)

// Disable buttons only during 2s lock after incorrect answer
const lockUntil = ref(0)
const disableActions = computed(() => Date.now() < lockUntil.value)
// Disable submit when answer empty (ignoring whitespace) and not yet checked
const disableSubmitEmpty = computed(() => !answer.value || !answer.value.trim())
// Combined disable state for the main submit button (either locked after wrong answer or empty input before first check)
const disableSubmit = computed(() => {
  const actionsDisabled = disableActions.value
  const emptyAndNotChecked = !result.checked && disableSubmitEmpty.value
  return actionsDisabled || emptyAndNotChecked
})

let nextTimer = null

const CASE_LABELS = {
  nom: 'Mianownik (kto? co?)',
  gen: 'Dopełniacz (kogo? czego?)',
  dat: 'Celownik (komu? czemu?)',
  acc: 'Biernik (kogo? co?)',
  inst: 'Narzędnik (z kim? z czym?)',
  loc: 'Miejscownik (o kim? o czym?)',
  voc: 'Wołacz (—!)'
}

const NUM_LABELS = {
  sg: 'liczba pojedyncza',
  pl: 'liczba mnoga'
}

function numberLabel(code){
  return code === 'sg' ? 'liczba pojedyncza' : code === 'pl' ? 'liczba mnoga' : code
}

const CASE_FULL = {
  nom: 'Mianownik',
  gen: 'Dopełniacz',
  dat: 'Celownik',
  acc: 'Biernik',
  inst: 'Narzędnik',
  loc: 'Miejscownik',
  voc: 'Wołacz'
}

const GENDER_LABELS = {
  m: 'męski',
  'm-pers': 'męskoosobowy', 
  f: 'żeński',
  n: 'nijaki'
}

// User-selected filters (empty means 'all')
const activeNumbers = ref(['sg', 'pl'])
const activeCases = ref([]) // empty -> all from data.cases
const activeGenders = ref([]) // empty -> all genders
const showFilters = ref(false)

// Watch for changes in filters and save to localStorage
watch(
  [activeNumbers, activeCases, activeGenders],
  ([newNumbers, newCases, newGenders]) => {
    const filtersToSave = {
      numbers: newNumbers,
      cases: newCases,
      genders: newGenders
    }
    localStorage.setItem('polskiStudyFilters', JSON.stringify(filtersToSave))
  },
  { deep: true }
)

function translationOf(word) {
  if (!word) return ''
  const w = word.replace(/[«»„”"']/g, '').toLowerCase()
  const adj = data.adjectives.find(a => a.base === w)
  if (adj && adj.translation) return adj.translation
  const noun = data.nouns.find(n => n.base === w)
  if (noun && noun.translation) return noun.translation
  return '(нет перевода)'
}

// Fetch dataset from public/data.json
async function loadData() {
  try {
    const resp = await fetch('./data.json', { cache: 'no-store' })
  if (!resp.ok) throw new Error('Nie udało się załadować data.json')
    const json = await resp.json()
    data.adjectives = json.adjectives
    data.nouns = json.nouns
    data.cases = json.cases
    loading.value = false
    makeQuestion()
  } catch (e) {
    error.value = e.message || String(e)
    loading.value = false
  }
}

// Normalize: trim multiple spaces & lower-case
function normalize(s) {
  return s
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// Pick random element helper
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function addIncorrectQuestion(questionData) {
  // Create a copy of the question data
  const incorrectQ = {
    baseAdj: questionData.baseAdj,
    baseNoun: questionData.baseNoun,
    targetCase: questionData.targetCase,
    targetNumber: questionData.targetNumber,
    correctAdj: questionData.correctAdj,
    correctNoun: questionData.correctNoun,
    correct: questionData.correct,
    gender: questionData.gender,
    timestamp: Date.now()
  }
  
  // Add to the beginning of the array
  incorrectQuestions.value.unshift(incorrectQ)
  
  // Keep only the most recent incorrect questions
  if (incorrectQuestions.value.length > MAX_INCORRECT_STORE) {
    incorrectQuestions.value = incorrectQuestions.value.slice(0, MAX_INCORRECT_STORE)
  }
  
  // Save to localStorage
  localStorage.setItem('polskiStudyIncorrect', JSON.stringify(incorrectQuestions.value))
}

function shouldRepeatIncorrectQuestion() {
  return incorrectQuestions.value.length > 0 && Math.random() < REPEAT_PROBABILITY
}

function getIncorrectQuestion() {
  if (incorrectQuestions.value.length === 0) return null
  
  // Prefer more recent mistakes (weighted selection)
  const weights = incorrectQuestions.value.map((_, index) => 
    Math.pow(0.8, index) // Exponential decay: newer mistakes have higher weight
  )
  
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let random = Math.random() * totalWeight
  
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i]
    if (random <= 0) {
      return incorrectQuestions.value[i]
    }
  }
  
  return incorrectQuestions.value[0] // fallback
}

function makeQuestion() {
  // clear any pending timer
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }

  // Check if we should repeat an incorrect question
  if (shouldRepeatIncorrectQuestion()) {
    const incorrectQ = getIncorrectQuestion()
    if (incorrectQ) {
      // Restore the incorrect question
      question.baseAdj = incorrectQ.baseAdj
      question.baseNoun = incorrectQ.baseNoun
      question.targetCase = incorrectQ.targetCase
      question.targetNumber = incorrectQ.targetNumber
      question.correctAdj = incorrectQ.correctAdj
      question.correctNoun = incorrectQ.correctNoun
      question.correct = incorrectQ.correct
      question.gender = incorrectQ.gender
      question.isRepeat = true

      // reset UI state
      answer.value = ''
      result.checked = false
      result.isCorrect = false
      result.message = ''
      result.correctAnswer = ''
      // Re-focus input after DOM updates
      focusAnswer()
      return
    }
  }

  // Generate new question (existing logic)
  // Filter nouns by selected genders
  const genderPool = activeGenders.value && activeGenders.value.length ? activeGenders.value : ['m', 'm-pers', 'f', 'n']
  const availableNouns = data.nouns.filter(noun => {
    // Check if noun matches gender filter
    if (genderPool.includes('m-pers') && noun.gender === 'm' && noun.masc_personal) {
      return true
    }
    if (genderPool.includes('m') && noun.gender === 'm' && !noun.masc_personal) {
      return true
    }
    if (genderPool.includes('f') && noun.gender === 'f') {
      return true
    }
    if (genderPool.includes('n') && noun.gender === 'n') {
      return true
    }
    return false
  })
  
  if (availableNouns.length === 0) {
    // No nouns available with current gender filter
    return
  }

  // Choose random adjective (we will display its masculine sg nominative form)
  const adj = pick(data.adjectives)

  // Choose random noun from filtered pool
  const noun = pick(availableNouns)

  // Determine pool respecting filters
  const numberPool = activeNumbers.value && activeNumbers.value.length ? activeNumbers.value : ['sg','pl']
  const casePool = activeCases.value && activeCases.value.length ? activeCases.value : data.cases
  const number = pick(numberPool)
  const kcase = pick(casePool)

  // Determine adjective target gender/number key
  let adjForm = ''
  if (number === 'sg') {
    const g = noun.gender // 'm' | 'f' | 'n'
    if (g === 'm' && kcase === 'acc' && noun.alive) {
      adjForm = adj.forms.sg.m.gen
    } else {
      adjForm = adj.forms.sg[g][kcase]
    }
  } else {
    // plural: choose m1 (masculine personal) for humans, else "other"
    const pluralKey = noun.masc_personal ? 'm1' : 'other'
    adjForm = adj.forms.pl[pluralKey][kcase]
  }

  const nounForm = noun.forms[number][kcase]

  question.baseAdj = adj.forms.sg.m.nom   // show masculine sg
  question.baseNoun = noun.forms.sg.nom   // show nominative sg
  question.targetCase = kcase
  question.targetNumber = number
  question.correctAdj = adjForm
  question.correctNoun = nounForm
  question.correct = normalize(adjForm + ' ' + nounForm)
  question.gender = noun.gender
  question.isRepeat = false

  // reset UI state
  answer.value = ''
  result.checked = false
  result.isCorrect = false
  result.message = ''
  result.correctAnswer = ''
  // Re-focus input after DOM updates (with retries for mobile keyboard reliability)
  focusAnswer()
}

function submitAnswer() {
  // Guard: if submit should be disabled (empty input & not in result state) do nothing
  if (!result.checked && disableSubmitEmpty.value) return
  if (result.checked) {
    // after showing result user manually moves to next
    nextQuestion(true)
    return
  }
  if (activeNumbers.value.length === 0) {
    // prevent answering when filters invalid
    result.checked = true
    result.isCorrect = false
    result.message = 'Brak wybranej liczby (wybierz sg/pl)'
    result.correctAnswer = ''
    return
  }
  const user = normalize(answer.value)
  const ok = user === question.correct
  result.checked = true
  result.isCorrect = ok
  if (ok) {
  result.message = 'Dobrze!'
    result.correctAnswer = ''
  } else {
  result.message = 'Źle.'
    result.correctAnswer = question.correctAdj + ' ' + question.correctNoun
    // Add incorrect question to the review list
    addIncorrectQuestion(question)
  }
  // Update stats (count only first check)
  stats.total++
  if (ok) stats.correct++
  if (ok) {
    // auto advance after short delay for correct answer
    nextTimer = setTimeout(() => nextQuestion(true), 1500)
  } else {
    // lock buttons for 2s then allow manual continue
    lockUntil.value = Date.now() + 2000
    nextTimer = setTimeout(() => { lockUntil.value = 0 }, 2000)
  }
}

function handleEnterKey() {
  // If already checked and correct, skip the delay and go to next question immediately
  if (result.checked && result.isCorrect) {
    if (nextTimer) {
      clearTimeout(nextTimer)
      nextTimer = null
    }
    nextQuestion(true)
    return
  }
  // Otherwise, submit the answer (same behavior as clicking submit button)
  submitAnswer()
}

function handleGlobalKeydown(event) {
  // Handle Enter key globally when result is shown and answer is correct
  if (event.key === 'Enter' && result.checked && result.isCorrect && nextTimer) {
    event.preventDefault()
    clearTimeout(nextTimer)
    nextTimer = null
    nextQuestion(true)
  }
}

function skipQuestion() {
  stats.total++
  stats.skipped++
  nextQuestion(false)
}

function nextQuestion(fromAnswer) {
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }
  makeQuestion()
}

onMounted(() => {
  const savedFilters = localStorage.getItem('polskiStudyFilters')
  if (savedFilters) {
    try {
      const parsed = JSON.parse(savedFilters)
      if (Array.isArray(parsed.numbers)) {
        activeNumbers.value = parsed.numbers
      }
      if (Array.isArray(parsed.cases)) {
        activeCases.value = parsed.cases
      }
      if (Array.isArray(parsed.genders)) {
        activeGenders.value = parsed.genders
      }
    } catch (e) {
      console.error('Could not parse saved filters', e)
    }
  }
  
  // Load saved incorrect questions
  const savedIncorrect = localStorage.getItem('polskiStudyIncorrect')
  if (savedIncorrect) {
    try {
      const parsed = JSON.parse(savedIncorrect)
      if (Array.isArray(parsed)) {
        incorrectQuestions.value = parsed
      }
    } catch (e) {
      console.error('Could not parse saved incorrect questions', e)
    }
  }
  
  // Add global keydown listener
  document.addEventListener('keydown', handleGlobalKeydown)
  
  loadData()
})

onUnmounted(() => {
  // Remove global keydown listener
  document.removeEventListener('keydown', handleGlobalKeydown)
  
  // Clear any pending timers
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }
})
</script>

<template>
  <v-app>
    <v-main>
      <v-container class="py-6" style="max-width: 840px;">
        <v-alert v-if="loading" type="info" variant="tonal" class="mb-4">Ładowanie…</v-alert>
        <v-alert v-else-if="error" type="error" variant="tonal" class="mb-4 center-text">Błąd: {{ error }}</v-alert>

        <v-card v-else :elevation="2" rounded="lg" class="mb-4">
          <v-card-text>
            <div class="mb-2 d-flex align-center" style="gap:.75rem;">
              <v-btn size="small" variant="text" @click="showFilters = !showFilters" :prepend-icon="showFilters ? 'mdi-chevron-up' : 'mdi-filter-variant'">
                {{ showFilters ? 'Ukryj filtry' : 'Filtry' }}
              </v-btn>
              <div v-if="!showFilters" class="text-caption text-medium-emphasis">
                <span>Liczba:
                  <strong>
                    {{ activeNumbers.length===2 ? 'liczba pojedyncza + liczba mnoga' : activeNumbers.map(n=>numberLabel(n)).join(', ') || '—' }}
                  </strong>
                </span>
                <span class="ml-2">Przypadki:
                  <strong>
                    {{ activeCases.length ? activeCases.map(c=>CASE_FULL[c]||c).join(', ') : 'wszystkie' }}
                  </strong>
                </span>
                <span class="ml-2">Rodzaj:
                  <strong>
                    {{ activeGenders.length ? activeGenders.map(g=>GENDER_LABELS[g]||g).join(', ') : 'wszystkie' }}
                  </strong>
                </span>
              </div>
            </div>
            <v-expand-transition>
              <div v-if="showFilters" class="mb-4 d-flex flex-column flex-sm-row align-start align-sm-center" style="gap:1rem;">
                <div class="d-flex flex-column" style="min-width:200px;">
                  <span class="text-caption text-medium-emphasis mb-1">Liczba</span>
                  <v-chip-group v-model="activeNumbers" multiple column density="comfortable" class="flex-wrap" selected-class="bg-primary text-white">
                    <v-chip value="sg" variant="outlined" size="small">liczba pojedyncza</v-chip>
                    <v-chip value="pl" variant="outlined" size="small">liczba mnoga</v-chip>
                  </v-chip-group>
                </div>
                <div class="d-flex flex-column" style="min-width:200px;">
                  <span class="text-caption text-medium-emphasis mb-1">Rodzaj</span>
                  <v-chip-group v-model="activeGenders" multiple column density="comfortable" class="flex-wrap" selected-class="bg-success text-white">
                    <v-chip value="m" variant="outlined" size="small">męski</v-chip>
                    <v-chip value="m-pers" variant="outlined" size="small">męskoosobowy</v-chip>
                    <v-chip value="f" variant="outlined" size="small">żeński</v-chip>
                    <v-chip value="n" variant="outlined" size="small">nijaki</v-chip>
                  </v-chip-group>
                  <div v-if="!activeGenders.length" class="text-caption text-disabled mt-1">(wszystkie rodzaje)</div>
                </div>
                <div class="flex-grow-1 d-flex flex-column">
                  <span class="text-caption text-medium-emphasis mb-1">Przypadki</span>
                  <v-chip-group v-model="activeCases" multiple column density="comfortable" class="flex-wrap" selected-class="bg-secondary text-white">
                    <v-chip v-for="c in data.cases" :key="c" :value="c" variant="outlined" size="small">{{ CASE_FULL[c] || c }}</v-chip>
                  </v-chip-group>
                  <div v-if="!activeCases.length" class="text-caption text-disabled mt-1">(wszystkie przypadki)</div>
                </div>
              </div>
            </v-expand-transition>
            <div class="mb-4 d-flex flex-column align-center text-center">
              <div class="d-flex align-center justify-center" style="gap:.5rem;">
                <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium" style="letter-spacing:.5px;">Wyjściowe słowa</div>
                <v-chip v-if="question.isRepeat" size="x-small" color="warning" variant="flat">powtórka</v-chip>
              </div>
              <div class="text-h4 font-weight-bold mt-1 d-flex flex-row flex-wrap align-center justify-center" style="line-height:1.15; gap:.5rem;">
                <v-tooltip location="bottom" open-on-click>
                  <template #activator="{ props }">
                    <span v-bind="props" class="cursor-pointer text-primary word-wrap">{{ question.baseAdj }}</span>
                  </template>
                  <span>{{ translationOf(question.baseAdj) }}</span>
                </v-tooltip>
                <v-tooltip location="bottom" open-on-click>
                  <template #activator="{ props }">
                    <span v-bind="props" class="cursor-pointer text-primary word-wrap">{{ question.baseNoun }}</span>
                  </template>
                  <span>{{ translationOf(question.baseNoun) }}</span>
                </v-tooltip>
              </div>
              <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mt-4" style="letter-spacing:.5px;">Wymagana forma</div>
              <div class="text-subtitle-1 font-weight-medium mt-1">{{ CASE_LABELS[question.targetCase] }} · {{ NUM_LABELS[question.targetNumber] }}</div>
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
              placeholder="przymiotnik + rzeczownik"
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
                  <span v-else >(Kliknij "Dalej" aby kontynuować)</span>
                </div>

                <v-alert :type="result.isCorrect ? 'success' : 'error'" variant="tonal" class="mb-2" :title="result.message" >
                  <template v-if="!result.isCorrect">
                    <h1 class="text-center">{{ result.correctAnswer }}</h1>
                  </template>
                </v-alert>
              </div>
            </transition>

            <div v-if="stats.total" class="mt-4 d-flex flex-column align-center text-center text-caption" style="opacity:.75;">
              <div><strong>{{ stats.correct }}</strong>/<span>{{ stats.total }}</span> ({{ accuracy }}%)</div>
              <div v-if="stats.skipped" class="mt-1">pominięte: {{ stats.skipped }}</div>
              <div v-if="incorrectQuestions.length" class="mt-1">do powtórki: {{ incorrectQuestions.length }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.cursor-pointer { cursor: pointer; }
.word-wrap {
  overflow-wrap: break-word;
  word-break: break-word; /* For wider browser support */
  hyphens: auto;
}
</style>
