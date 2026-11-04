<template>
  <div class="counter">
    <h2>{{ label }}</h2>
    <p class="value" :class="{ warn: count > limit }">{{ count }}</p>
    <button @click="decrement" :disabled="count === 0">-</button>
    <button @click="increment">+</button>
    <button v-if="count > 0" @click="reset">Reset</button>
    <ul>
      <li v-for="entry in history" :key="entry.at">{{ entry.text }}</li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'Counter',
  props: {
    label: { type: String, default: 'Visitors' },
    limit: { type: Number, default: 100 },
  },
  data() {
    return { count: 0, history: [] };
  },
  computed: {
    full() {
      return this.count >= this.limit;
    },
  },
  methods: {
    increment() {
      this.count++;
      this.log('added one');
    },
    decrement() {
      if (this.count > 0) this.count--;
      this.log('took one away');
    },
    reset() {
      this.count = 0;
      this.log('reset');
    },
    log(text) {
      this.history.unshift({ text, at: Date.now() });
    },
  },
};
</script>

<style scoped>
.counter { padding: 1rem; border: 1px solid #ccc; }
.value { font-size: 2rem; }
.warn { color: #b00020; }
</style>
