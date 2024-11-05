import { defineStore } from 'pinia'

export const useQueueStore = defineStore('queue', {
    state: () => ({
        total: 0,
        progress: 0
    }),

    actions: {
        setTotal(count) {
            this.total = count
        },

        incrementProgress() {
            this.progress++
        },

        reset() {
            this.progress = 0
            this.total = 0
        }
    }
})
