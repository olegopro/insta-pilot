import { ref, computed, watch, nextTick } from 'vue'
import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
import type { InstagramAccount } from '@/entities/instagram-account/model/types'
import type { Nullable } from '@/shared/lib'

export const useAccountSelect = (storageKey: string) => {
  const accountStore = useAccountStore()

  const selectedAccount = ref<Nullable<InstagramAccount>>(null)
  const accountSelectRef = ref<{ blur: () => void }>()
  const isInitializing = ref(true)

  const accountStackLabel = computed(() => !!selectedAccount.value || !!localStorage.getItem(storageKey))

  watch(selectedAccount, (account) => {
    if (account) {
      localStorage.setItem(storageKey, String(account.id))
    } else {
      localStorage.removeItem(storageKey)
      void nextTick(() => accountSelectRef.value?.blur())
    }
  })

  const initAccounts = async () => {
    await accountStore.fetchAccounts()
    const savedId = localStorage.getItem(storageKey)
    if (savedId) {
      const found = accountStore.accounts.find((account) => String(account.id) === savedId)
      found && (selectedAccount.value = found)
    }
    isInitializing.value = false
  }

  return {
    selectedAccount,
    accountSelectRef,
    accountStackLabel,
    isInitializing,
    initAccounts
  }
}
