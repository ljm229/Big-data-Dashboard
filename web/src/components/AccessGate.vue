<template>
  <div v-if="!unlocked" class="gate">
    <form class="gate__card" @submit.prevent="submit">
      <div class="gate__mark">密</div>
      <h1>电商数据大屏</h1>
      <p>请输入访问密码</p>
      <input
        v-model="password"
        type="password"
        autocomplete="current-password"
        placeholder="访问密码"
        autofocus
      />
      <button type="submit">进入</button>
      <em v-if="error" class="gate__err">{{ error }}</em>
    </form>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ACCESS_STORAGE_KEY, SITE_PASSWORD } from '../config/access'

const unlocked = ref(false)
const password = ref('')
const error = ref('')

onMounted(() => {
  try {
    if (sessionStorage.getItem(ACCESS_STORAGE_KEY) === '1') unlocked.value = true
  } catch {
    /* ignore */
  }
})

function submit() {
  if (password.value.trim() === SITE_PASSWORD) {
    unlocked.value = true
    error.value = ''
    try {
      sessionStorage.setItem(ACCESS_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    return
  }
  error.value = '密码错误'
  password.value = ''
}
</script>

<style scoped lang="scss">
.gate {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(ellipse 70% 50% at 50% 30%, rgba(36, 90, 170, 0.35), transparent 65%),
    linear-gradient(180deg, #071c48 0%, #041330 50%, #020914 100%);
  color: #e8f3ff;
}
.gate__card {
  width: min(360px, 100%);
  padding: 28px 24px 24px;
  border-radius: 16px;
  background: rgba(8, 24, 56, 0.88);
  border: 1px solid rgba(94, 200, 255, 0.28);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gate__mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 800;
  background: rgba(94, 200, 255, 0.16);
  border: 1px solid rgba(94, 200, 255, 0.35);
}
h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}
p {
  margin: 0;
  font-size: 13px;
  color: rgba(200, 220, 245, 0.72);
}
input {
  height: 42px;
  border-radius: 10px;
  border: 1px solid rgba(94, 200, 255, 0.35);
  background: rgba(2, 10, 28, 0.65);
  color: #e8f3ff;
  padding: 0 12px;
  font-size: 15px;
  outline: none;
  &:focus {
    border-color: #7ed0ff;
  }
}
button {
  height: 42px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #9adfff, #3aa0ff);
  color: #04122a;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
}
.gate__err {
  font-style: normal;
  font-size: 12px;
  color: #ff8f8f;
}
</style>
