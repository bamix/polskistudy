<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'

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

const accuracy = computed(() => stats.total ? Math.round((stats.correct / stats.total) * 100) : 0)

// Disable buttons only during 2s lock after incorrect answer
const lockUntil = ref(0)
const disableActions = computed(() => Date.now() < lockUntil.value)
// Disable submit when answer empty (ignoring whitespace) and not yet checked
const disableSubmitEmpty = computed(() => !answer.value || !answer.value.trim())
// Combined disable state for the main submit button (either locked after wrong answer or empty input before first check)
const disableSubmit = computed(() => disableActions.value || (!result.checked && disableSubmitEmpty.value))

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

// User-selected filters (empty means 'all')
const activeNumbers = ref(['sg', 'pl'])
const activeCases = ref([]) // empty -> all from data.cases
const showFilters = ref(false)

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

function makeQuestion() {
  // clear any pending timer
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }

  // Choose random adjective (we will display its masculine sg nominative form)
  const adj = pick(data.adjectives)

  // Choose random noun (we will display its nominative singular form)
  const noun = pick(data.nouns)

  // Determine pool respecting filters
  const numberPool = activeNumbers.value && activeNumbers.value.length ? activeNumbers.value : ['sg','pl']
  const casePool = activeCases.value && activeCases.value.length ? activeCases.value : data.cases
  const number = pick(numberPool)
  const kcase = pick(casePool)

  // Determine adjective target gender/number key
  let adjForm = ''
  if (number === 'sg') {
    const g = noun.gender // 'm' | 'f' | 'n'
    adjForm = adj.forms.sg[g][kcase]
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

onMounted(loadData)
</script>

<template>
  <v-app>
    <v-app-bar density="comfortable" color="primary" dark flat>
        <v-app-bar-title>Trener odmiany (polski)</v-app-bar-title>
        <v-spacer />
        <v-btn icon="mdi-refresh" variant="text" @click="makeQuestion" :disabled="loading" />
      </v-app-bar>
    <v-main>
      <v-container class="py-6" style="max-width: 840px;">
  <v-alert v-if="loading" type="info" variant="tonal" class="mb-4">Ładowanie…</v-alert>
  <v-alert v-else-if="error" type="error" variant="tonal" class="mb-4 center-text">Błąd: {{ error }}</v-alert>

        <v-card v-else :elevation="2" rounded="lg" class="mb-4">
          <v-card-text>
            <div class="text-medium-emphasis mb-4">
              Wpisz <strong>przymiotnik + rzeczownik</strong> w podanym przypadku i liczbie.
            </div>
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
              <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium" style="letter-spacing:.5px;">Wyjściowe słowa</div>
              <div class="text-h4 font-weight-bold mt-1 d-flex flex-row align-center justify-center" style="line-height:1.15; gap:.5rem;">
                <v-tooltip location="bottom" open-on-click>
                  <template #activator="{ props }">
                    <span v-bind="props" class="cursor-pointer text-primary">{{ question.baseAdj }}</span>
                  </template>
                  <span>{{ translationOf(question.baseAdj) }}</span>
                </v-tooltip>
                <v-tooltip location="bottom" open-on-click>
                  <template #activator="{ props }">
                    <span v-bind="props" class="cursor-pointer text-primary">{{ question.baseNoun }}</span>
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
              @keyup.enter="submitAnswer"
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
</style>

<!-- Removed custom global utility styles in favor of Vuetify utility classes -->
