<script setup>
import { ref, reactive, onMounted, computed } from 'vue'

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

// Simple Polish->Russian translation dictionary (extend as needed)
const TRANSLATIONS = {
  nowy: 'новый',
  duży: 'большой',
  dom: 'дом',
  stół: 'стол',
  telefon: 'телефон',
  kawa: 'кофе',
  książka: 'книга',
  okno: 'окно'
}

function translationOf(word) {
  if (!word) return ''
  // normalize to base (remove possible punctuation / quotes)
  const w = word.replace(/[«»„”"']/g, '').toLowerCase()
  return TRANSLATIONS[w] || '(нет перевода)'
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

  // Random number and case
  const number = Math.random() < 0.5 ? 'sg' : 'pl'
  const kcase = pick(data.cases)

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
}

function submitAnswer() {
  if (result.checked) {
    // after showing result user manually moves to next
    nextQuestion(true)
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
              autofocus
              hide-details="auto"
              @keyup.enter="submitAnswer"
              placeholder="przymiotnik + rzeczownik"
            />

            <div class="mt-4 d-flex flex-column">
              <v-btn block color="success" @click="submitAnswer" :prepend-icon="result.checked ? 'mdi-skip-next' : 'mdi-check'" :disabled="disableActions">
                {{ result.checked ? 'Dalej' : 'Wyślij' }}
              </v-btn>
              <v-btn block class="mt-2" variant="text" @click="skipQuestion" prepend-icon="mdi-skip-forward" :disabled="disableActions">Pomiń</v-btn>
            </div>

            <div v-if="stats.total" class="mt-4 d-flex flex-column align-center text-center text-caption" style="opacity:.75;">
              <div><strong>{{ stats.correct }}</strong>/<span>{{ stats.total }}</span> ({{ accuracy }}%)</div>
              <div v-if="stats.skipped" class="mt-1">pominięte: {{ stats.skipped }}</div>
            </div>

            <transition name="fade">
              <div v-if="result.checked" class="mt-5">
                <v-alert :type="result.isCorrect ? 'success' : 'error'" variant="tonal" class="mb-2">
                  {{ result.message }}
                  <template v-if="!result.isCorrect" #append>
                    <span class="font-weight-medium">Poprawnie: {{ result.correctAnswer }}</span>
                  </template>
                </v-alert>
                <div v-if="result.isCorrect" class="text-caption text-medium-emphasis">(Automatycznie dalej)</div>
                <div v-else class="text-caption text-medium-emphasis" :class="{ 'opacity-50': disableActions }">
                  <span v-if="disableActions">(Odblokowanie za 2 s)</span>
                  <span v-else>(Kliknij "Dalej" aby kontynuować)</span>
                </div>
              </div>
            </transition>
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
