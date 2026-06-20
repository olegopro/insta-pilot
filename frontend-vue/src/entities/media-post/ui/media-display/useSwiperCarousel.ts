import { ref, watch } from 'vue'
import type { Swiper as SwiperClass } from 'swiper'
import type { Ref } from 'vue'
import type { Nullable } from 'src/shared/lib'

/**
 * Инкапсулирует логику Swiper-карусели: инициализацию, навигацию через
 * колёсико мыши и двустороннюю синхронизацию активного слайда.
 *
 * @param carouselSlide — реактивный индекс активного слайда (v-model)
 * @param getPost — геттер текущего поста (для сброса слайда при смене поста)
 */
export function useSwiperCarousel(
  carouselSlide: Ref<number>,
  getPost: () => { id?: string; pk?: string }
) {
  const swiperRef = ref<Nullable<SwiperClass>>(null)

  /**
   * Флаг блокировки колёсика — предотвращает двойное срабатывание при
   * быстрой прокрутке. Сбрасывается через 500 мс.
   */
  let wheelLocked = false

  /**
   * Обработчик события `wheel` на контейнере Swiper.
   *
   * Реагирует только на физическое колёсико мыши — у него `deltaY >= 50`
   * и `deltaX < deltaY`. Трекпад генерирует непрерывные мелкие события
   * (`deltaY < 20`) — они намеренно игнорируются, чтобы не перехватывать
   * вертикальный скролл страницы при горизонтальном свайпе.
   */
  const wheelHandler = (event: WheelEvent) => {
    const deltaX = Math.abs(event.deltaX)
    const deltaY = Math.abs(event.deltaY)
    if (deltaX >= deltaY || deltaY < 50 || !swiperRef.value || wheelLocked) return
    event.preventDefault()
    wheelLocked = true
    setTimeout(() => wheelLocked = false, 500)
    event.deltaY > 0 ? swiperRef.value.slideNext() : swiperRef.value.slidePrev()
  }

  /**
   * Вызывается при событии `@swiper` — сохраняет ссылку на экземпляр Swiper
   * и навешивает `wheelHandler` с `passive: false` (чтобы `preventDefault` работал).
   */
  const swiperInitHandler = (swiper: SwiperClass) => {
    swiperRef.value = swiper
    swiper.el.addEventListener('wheel', wheelHandler, { passive: false })
  }

  /**
   * Вызывается при событии `@slide-change` — синхронизирует индекс активного
   * слайда с внешней v-model переменной `carouselSlide`.
   */
  const slideChangeHandler = (swiper: SwiperClass) => carouselSlide.value = swiper.activeIndex

  // Внешнее изменение carouselSlide (например, из PostDetailModal) → прокрутка Swiper
  watch(carouselSlide, (index) => swiperRef.value?.activeIndex !== index && swiperRef.value?.slideTo(index))

  // Смена поста → сброс Swiper на первый слайд мгновенно (speed=0)
  watch(getPost, () => swiperRef.value?.slideTo(0, 0))

  return { swiperRef, swiperInitHandler, slideChangeHandler }
}
