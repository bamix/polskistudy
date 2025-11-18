import { createRouter, createWebHistory } from 'vue-router'
import Declension from '../views/Declension.vue'
import Pronouns from '../views/Pronouns.vue'
import Numerals from '../views/Numerals.vue'

const routes = [
  {
    path: '/',
    name: 'Declension',
    component: Declension
  },
  {
    path: '/pronouns',
    name: 'Pronouns',
    component: Pronouns
  },
  {
    path: '/numerals',
    name: 'Numerals',
    component: Numerals
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
