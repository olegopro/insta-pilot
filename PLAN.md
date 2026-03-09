# insta-pilot — Plan

## Текущая цель
MVP без авторизации: управление Instagram аккаунтами.

---

## Нейминг

| Термин | Описание |
|--------|----------|
| `user` | Пользователь системы insta-pilot (будет позже) |
| `instagram-account` | Instagram аккаунт, добавленный в систему |
| `task` | Задача авто-лайкинга (будет позже) |

---

## Frontend — FSD структура

```
src/
├── boot/             # Quasar (axios)
├── layouts/          # MainLayout
├── router/           # routes

├── shared/
│   ├── api/
│   │   ├── apiTypes.ts       # ApiResponseWrapper<T>
│   │   └── useApi.ts         # composable
│   ├── lib/
│   │   └── commonTypes.ts    # Nullable<T>
│   └── ui/                   # ← кастомные обёртки над Quasar

├── entities/
│   └── instagram-account/
│       ├── model/
│       │   ├── types.ts
│       │   └── accountStore.ts
│       └── ui/
│           └── ProfileCard.vue

├── features/
│   ├── add-instagram-account/     # форма добавления (модалка)
│   ├── delete-instagram-account/  # кнопка удалить
│   └── view-instagram-account/    # модалка просмотра аккаунта

├── widgets/
│   └── instagram-accounts-list/   # таблица аккаунтов

└── pages/
    ├── login/                      # временно, потом станет модалкой
    └── instagram-accounts/         # главная страница
```

---

## Чеклист

### Фаза 0 — Основа ✅
- [x] FSD структура (папки, перенос файлов)
- [x] shared/api: useApi, apiTypes
- [x] shared/lib: commonTypes
- [x] entities/instagram-account: types, accountStore, ProfileCard
- [x] pages/login: LoginPage (временно)
- [x] MainLayout — базовая шапка

### Фаза 1 — shared/ui (базовые компоненты)
- [ ] ButtonComponent — обёртка над QBtn
- [x] InputComponent — обёртка над QInput
- [ ] ModalComponent — обёртка над QDialog

### Фаза 2 — Instagram Accounts страница
- [ ] pages/instagram-accounts — основная страница
- [ ] widgets/instagram-accounts-list — таблица аккаунтов
- [ ] features/add-instagram-account — модалка добавить аккаунт
- [ ] features/delete-instagram-account — удалить аккаунт
- [ ] features/view-instagram-account — модалка просмотра аккаунта

### Фаза 3 — Авторизация пользователей (потом)
- [ ] entities/user — модель пользователя
- [ ] features/login — форма входа
- [ ] features/register — форма регистрации
- [ ] Auth guard в роутере

### Фаза 4 — Задачи авто-лайкинга (потом)
- [ ] entities/task
- [ ] features/create-task
- [ ] features/start-task / stop-task
- [ ] widgets/tasks-list
- [ ] pages/tasks
