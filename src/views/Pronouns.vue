<template>
  <v-container class="py-6" style="max-width: 840px;">
    <v-card :elevation="2" rounded="lg" class="mb-4">
      <v-card-text>
        <div class="mb-2 d-flex align-center" style="gap:.75rem;">
          <v-btn size="small" variant="text" @click="showFilters = !showFilters" :prepend-icon="showFilters ? 'mdi-chevron-up' : 'mdi-filter-variant'">
            {{ showFilters ? 'Ukryj filtry' : 'Filtry' }}
          </v-btn>
          <div v-if="!showFilters" class="text-caption text-medium-emphasis">
            <span>Przypadki:
              <strong>
                {{ activeCases.length ? activeCases.map(c=>CASE_FULL[c]||c).join(', ') : 'wszystkie' }}
              </strong>
            </span>
            <span class="ml-2">Typ:
              <strong>
                {{ activePronounTypes.length ? activePronounTypes.map(t=>PRONOUN_TYPE_LABELS[t]||t).join(', ') : 'wszystkie' }}
              </strong>
            </span>
          </div>
        </div>
        <v-expand-transition>
          <div v-if="showFilters" class="mb-4 d-flex flex-column flex-sm-row align-start align-sm-center" style="gap:1rem;">
            <div class="d-flex flex-column" style="min-width:200px;">
              <span class="text-caption text-medium-emphasis mb-1">Przypadki</span>
              <v-chip-group v-model="activeCases" multiple column density="comfortable" class="flex-wrap" selected-class="bg-primary text-white">
                <v-chip v-for="c in cases" :key="c" :value="c" variant="outlined" size="small">{{ CASE_FULL[c] || c }}</v-chip>
              </v-chip-group>
              <div v-if="!activeCases.length" class="text-caption text-disabled mt-1">(wszystkie przypadki)</div>
            </div>
            <div class="d-flex flex-column" style="min-width:200px;">
              <span class="text-caption text-medium-emphasis mb-1">Typ zaimków</span>
              <v-chip-group v-model="activePronounTypes" multiple column density="comfortable" class="flex-wrap" selected-class="bg-success text-white">
                <v-chip value="personal" variant="outlined" size="small">osobowe</v-chip>
                <v-chip value="possessive" variant="outlined" size="small">dzierżawcze</v-chip>
                <v-chip value="demonstrative" variant="outlined" size="small">wskazujące</v-chip>
                <v-chip value="zwrotne" variant="outlined" size="small">zwrotne</v-chip>
                <v-chip value="pytające" variant="outlined" size="small">pytające</v-chip>
              </v-chip-group>
              <div v-if="!activePronounTypes.length" class="text-caption text-disabled mt-1">(wszystkie typy)</div>
            </div>
          </div>
        </v-expand-transition>
        <div class="mb-4 d-flex flex-column align-center text-center">
          <div class="d-flex align-center justify-center" style="gap:.5rem;">
            <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium" style="letter-spacing:.5px;">Wyjściowe zaimek</div>
          </div>
          <div class="text-h4 font-weight-bold mt-1 d-flex flex-row flex-wrap align-center justify-center" style="line-height:1.15; gap:.5rem;">
            <span class="text-primary word-wrap">{{ question.basePronoun }}</span>
            <span class="text-caption text-medium-emphasis">({{ PRONOUN_TYPE_LABELS[question.pronounType] }})</span>
          </div>
          <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mt-4" style="letter-spacing:.5px;">Wymagana forma</div>
          <div class="text-subtitle-1 font-weight-medium mt-1">{{ CASE_LABELS[question.targetCase] }}</div>
        </div>

        <v-text-field
          v-model="answer"
          label="Odpowiedź (wszystkie możliwe formy)"
          variant="outlined"
          density="comfortable"
          :disabled="result.checked && !disableActions" 
          ref="answerField"
          hide-details="auto"
          @keyup.enter="handleEnterKey"
          placeholder="wpisz wszystkie formy przez przestrzeń"
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
import { ref, reactive, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'

const question = reactive({
  basePronoun: '',
  targetCase: 'nom',
  pronounType: 'personal',
  correctForms: []
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

const cases = ['nom', 'gen', 'dat', 'acc', 'inst', 'loc']

const CASE_LABELS = {
  nom: 'Mianownik (kto? co?)',
  gen: 'Dopełniacz (kogo? czego?)',
  dat: 'Celownik (komu? czemu?)',
  acc: 'Biernik (kogo? co?)',
  inst: 'Narzędnik (z kim? z czym?)',
  loc: 'Miejscownik (o kim? o czym?)'
}

const CASE_FULL = {
  nom: 'Mianownik',
  gen: 'Dopełniacz',
  dat: 'Celownik',
  acc: 'Biernik',
  inst: 'Narzędnik',
  loc: 'Miejscownik'
}

const PRONOUN_TYPE_LABELS = {
  personal: 'osobowe',
  possessive: 'dzierżawcze',
  demonstrative: 'wskazujące',
  zwrotne: 'zwrotne',
  pytające: 'pytające'
}

// Filters
const activeCases = ref([])
const activePronounTypes = ref([])
const showFilters = ref(false)

// Watch for changes in filters and save to localStorage
watch(
  [activeCases, activePronounTypes],
  ([newCases, newTypes]) => {
    const filtersToSave = {
      cases: newCases,
      pronounTypes: newTypes
    }
    localStorage.setItem('polskiStudyPronounFilters', JSON.stringify(filtersToSave))
  },
  { deep: true }
)

// Pronouns data
const pronounsData = {
  personal: {
    'ja': {
      nom: ['ja'],
      gen: ['mnie'],
      dat: ['mi', 'mnie'],
      acc: ['mnie'],
      inst: ['mną'],
      loc: ['mnie']
    },
    'ty': {
      nom: ['ty'],
      gen: ['cię', 'ciebie'],
      dat: ['ci', 'tobie'],
      acc: ['cię', 'ciebie'],
      inst: ['tobą'],
      loc: ['tobie']
    },
    'on': {
      nom: ['on'],
      gen: ['go', 'jego', 'niego'],
      dat: ['mu', 'jemu', 'niemu'],
      acc: ['go', 'jego', 'niego'],
      inst: ['nim'],
      loc: ['nim']
    },
    'ona': {
      nom: ['ona'],
      gen: ['jej', 'niej'],
      dat: ['jej', 'niej'],
      acc: ['ją', 'nią'],
      inst: ['nią'],
      loc: ['niej']
    },
    'ono': {
      nom: ['ono'],
      gen: ['go', 'jego', 'niego'],
      dat: ['mu', 'jemu', 'niemu'],
      acc: ['je', 'nie'],
      inst: ['nim'],
      loc: ['nim']
    },
    'my': {
      nom: ['my'],
      gen: ['nas'],
      dat: ['nam'],
      acc: ['nas'],
      inst: ['nami'],
      loc: ['nas']
    },
    'wy': {
      nom: ['wy'],
      gen: ['was'],
      dat: ['wam'],
      acc: ['was'],
      inst: ['wami'],
      loc: ['was']
    },
    'oni': {
      nom: ['oni'],
      gen: ['ich', 'nich'],
      dat: ['im', 'nim'],
      acc: ['ich', 'nich'],
      inst: ['nimi'],
      loc: ['nich']
    },
    'one': {
      nom: ['one'],
      gen: ['ich', 'nich'],
      dat: ['im', 'nim'],
      acc: ['je', 'nie'],
      inst: ['nimi'],
      loc: ['nich']
    }
  },
  zwrotne: {
    'siebie': {
      nom: [],
      gen: ['siebie', 'się'],
      dat: ['sobie'],
      acc: ['siebie', 'się'],
      inst: ['sobą'],
      loc: ['sobie']
    }
  },
  pytające: {
    'kto': {
      nom: ['kto'],
      gen: ['kogo'],
      dat: ['komu'],
      acc: ['kogo'],
      inst: ['kim'],
      loc: ['kim']
    },
    'co': {
      nom: ['co'],
      gen: ['czego'],
      dat: ['czemu'],
      acc: ['co'],
      inst: ['czym'],
      loc: ['czym']
    },
    'który': {
      nom: ['który', 'która', 'które'],
      gen: ['którego', 'której'],
      dat: ['któremu', 'której'],
      acc: ['który', 'którego', 'którą', 'które'],
      inst: ['którym', 'którą'],
      loc: ['którym', 'której']
    }
  },
  possessive: {
    'mój': {
      nom: ['mój', 'moja', 'moje'],
      gen: ['mojego', 'mojej'],
      dat: ['mojemu', 'mojej'],
      acc: ['mój', 'mojego', 'moją', 'moje'],
      inst: ['moim', 'moją'],
      loc: ['moim', 'mojej']
    },
    'twój': {
      nom: ['twój', 'twoja', 'twoje'],
      gen: ['twojego', 'twojej'],
      dat: ['twojemu', 'twojej'],
      acc: ['twój', 'twojego', 'twoją', 'twoje'],
      inst: ['twoim', 'twoją'],
      loc: ['twoim', 'twojej']
    },
    'jego': {
      nom: ['jego'],
      gen: ['jego'],
      dat: ['jego'],
      acc: ['jego'],
      inst: ['jego'],
      loc: ['jego']
    },
    'jej': {
      nom: ['jej'],
      gen: ['jej'],
      dat: ['jej'],
      acc: ['jej'],
      inst: ['jej'],
      loc: ['jej']
    },
    'nasz': {
      nom: ['nasz', 'nasza', 'nasze'],
      gen: ['naszego', 'naszej'],
      dat: ['naszemu', 'naszej'],
      acc: ['nasz', 'naszego', 'naszą', 'nasze'],
      inst: ['naszym', 'naszą'],
      loc: ['naszym', 'naszej']
    },
    'wasz': {
      nom: ['wasz', 'wasza', 'wasze'],
      gen: ['waszego', 'waszej'],
      dat: ['waszemu', 'waszej'],
      acc: ['wasz', 'waszego', 'waszą', 'wasze'],
      inst: ['waszym', 'waszą'],
      loc: ['waszym', 'waszej']
    },
    'ich': {
      nom: ['ich'],
      gen: ['ich'],
      dat: ['ich'],
      acc: ['ich'],
      inst: ['ich'],
      loc: ['ich']
    }
  },
  demonstrative: {
    'ten': {
      nom: ['ten', 'ta', 'to'],
      gen: ['tego', 'tej'],
      dat: ['temu', 'tej'],
      acc: ['ten', 'tego', 'tę', 'to'],
      inst: ['tym', 'tą'],
      loc: ['tym', 'tej']
    },
    'tamten': {
      nom: ['tamten', 'tamta', 'tamto'],
      gen: ['tamtego', 'tamtej'],
      dat: ['tamtemu', 'tamtej'],
      acc: ['tamten', 'tamtego', 'tamtę', 'tamto'],
      inst: ['tamtym', 'tamtą'],
      loc: ['tamtym', 'tamtej']
    }
  }
}

// Normalize function
function normalize(s) {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

// Pick random element helper
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeQuestion() {
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }

  // Determine pools respecting filters
  const pronounTypePool = activePronounTypes.value && activePronounTypes.value.length 
    ? activePronounTypes.value 
    : ['personal', 'possessive', 'demonstrative', 'zwrotne', 'pytające']
  const casePool = activeCases.value && activeCases.value.length ? activeCases.value : cases

  // Choose random type and case
  const pronounType = pick(pronounTypePool)
  const targetCase = pick(casePool.filter(c => c !== 'nom')) // exclude nominative as target

  // Choose random pronoun from selected type
  const pronounsOfType = Object.keys(pronounsData[pronounType])
  const basePronoun = pick(pronounsOfType)

  question.basePronoun = basePronoun
  question.targetCase = targetCase
  question.pronounType = pronounType
  question.correctForms = pronounsData[pronounType][basePronoun][targetCase]

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

  // Parse user input - split by comma and normalize each part
  const userAnswers = answer.value
    .split(' ')
    .map(a => normalize(a))
    .filter(a => a.length > 0)

  // Check if user provided all correct forms
  const correctForms = question.correctForms.map(f => normalize(f))
  const allCorrect = correctForms.every(form => userAnswers.includes(form))
  const noExtra = userAnswers.every(form => correctForms.includes(form))
  const isCorrect = allCorrect && noExtra

  result.checked = true
  result.isCorrect = isCorrect

  if (isCorrect) {
    result.message = 'Dobrze!'
    result.correctAnswer = ''
  } else {
    result.message = 'Źle.'
    result.correctAnswer = question.correctForms.join(' ')
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
  const savedFilters = localStorage.getItem('polskiStudyPronounFilters')
  if (savedFilters) {
    try {
      const parsed = JSON.parse(savedFilters)
      if (Array.isArray(parsed.cases)) {
        activeCases.value = parsed.cases
      }
      if (Array.isArray(parsed.pronounTypes)) {
        activePronounTypes.value = parsed.pronounTypes
      }
    } catch (e) {
      console.error('Could not parse saved pronoun filters', e)
    }
  }

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
.word-wrap {
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
}
</style>