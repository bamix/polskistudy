<template>
  <v-app>
    <v-main style="padding-bottom: 72px;">
      <router-view />
    </v-main>
    
    <v-bottom-navigation 
      v-model="activeTab" 
      fixed 
      grow 
      color="primary"
      bg-color="surface"
      :elevation="8"
    >
      <v-btn value="declension" @click="$router.push('/')">
        <v-icon>mdi-book-alphabet</v-icon>
        <span>Odmiana</span>
      </v-btn>
      
      <v-btn value="pronouns" @click="$router.push('/pronouns')">
        <v-icon>mdi-account-group</v-icon>
        <span>Zaimki</span>
      </v-btn>
      
      <v-btn value="numerals" @click="$router.push('/numerals')">
        <v-icon>mdi-numeric</v-icon>
        <span>Liczebniki</span>
      </v-btn>
      
      <v-btn value="vocabulary" @click="$router.push('/vocabulary')">
        <v-icon>mdi-book-open-page-variant</v-icon>
        <span>Słownik</span>
      </v-btn>
    
    </v-bottom-navigation>
  </v-app>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeTab = ref('declension')

// Update active tab based on current route
watch(() => route.path, (newPath) => {
  if (newPath === '/') {
    activeTab.value = 'declension'
  } else if (newPath === '/pronouns') {
    activeTab.value = 'pronouns'
  } else if (newPath === '/numerals') {
    activeTab.value = 'numerals'
  } else if (newPath === '/vocabulary') {
    activeTab.value = 'vocabulary'
  }
}, { immediate: true })
</script>
