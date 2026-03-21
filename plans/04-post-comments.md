# Задача 4: Загрузка и отображение комментариев в PostDetailModal

## Цель

При открытии поста в модальном окне — загружать существующие комментарии (минимум 15 шт.) и отображать их в правой панели, выше секции отправки комментария. Поддержка:
- Пагинация: кнопка «Загрузить ещё»
- Вложенные комментарии (replies/threads)
- Превью дочерних комментариев (Instagram отдаёт `preview_child_comments`)

## Текущее состояние

- **Python:** Метод `cl.media_comment()` (публикация) реализован. Загрузка комментариев — **не реализована**.
- **Laravel:** Endpoint `POST /media/{mediaId}/comment` (публикация). Загрузка — **нет**.
- **Frontend:** Счётчик `commentCount` в MediaPost. Список комментариев — **не отображается**.

## Исследование instagrapi

### Доступные методы

| Метод | Описание | Пагинация |
|-------|----------|-----------|
| `media_comments(media_id, amount)` | Загружает все комментарии (автопагинация) | Автоматическая |
| `media_comments_chunk(media_id, max_amount, min_id)` | Одна страница комментариев | Ручная, `min_id` (курсор) |

Для нашей задачи нужен `media_comments_chunk` — даёт контроль над пагинацией.

### Модель Comment (instagrapi)

```python
class Comment:
    pk: str                           # PK комментария
    text: str                         # текст
    user: UserShort                   # автор (pk, username, full_name, profile_pic_url)
    created_at_utc: datetime          # дата UTC
    content_type: str                 # "comment"
    status: str                       # "Active"
    replied_to_comment_id: Optional[str]  # PK родительского (если это reply)
    has_liked: Optional[bool]         # лайкнул ли текущий пользователь
    like_count: Optional[int]         # число лайков
```

### Проблема с вложенными комментариями

Pydantic-модель `Comment` в instagrapi **отбрасывает** поля:
- `child_comment_count` — количество дочерних комментариев
- `preview_child_comments` — превью первых 1-3 ответов
- `has_more_head_child_comments`

Для загрузки всех replies конкретного комментария в instagrapi **нет обёртки**. Instagram Private API endpoint:
```
GET media/{media_id}/comments/{comment_pk}/child_comments/
```

### Решение

Использовать `cl.private_request()` напрямую вместо `media_comments_chunk()` для полного контроля:
1. Загрузка корневых комментариев: `GET media/{media_pk}/comments/?can_support_threading=true`
2. Из raw response извлекать `child_comment_count` и `preview_child_comments`
3. Загрузка replies: `GET media/{media_pk}/comments/{comment_pk}/child_comments/`

## Реализация

### Шаг 1: Python — endpoint для загрузки комментариев

**Файл:** `python-service/schemas.py` — добавить схемы

```python
class FetchCommentsRequest(BaseModel):
    session_data: str
    media_pk: str            # числовой PK поста (не media_id!)
    amount: int = 20
    min_id: Optional[str] = None   # курсор для пагинации

class CommentItem(BaseModel):
    pk: str
    text: str
    created_at_utc: str      # ISO 8601
    like_count: int
    has_liked: bool
    replied_to_comment_id: Optional[str]
    child_comment_count: int
    user: dict               # { pk, username, full_name, profile_pic_url }
    preview_child_comments: list  # вложенные CommentItem-like dicts

class FetchCommentsResponse(BaseModel):
    success: bool
    comments: list           # List[CommentItem-like dict]
    next_min_id: Optional[str]
    comment_count: int       # общее количество комментариев у поста
```

**Файл:** `python-service/main.py` — добавить endpoint

```python
@app.post("/media/comments")
def fetch_media_comments(data: FetchCommentsRequest):
    """
    Загружает комментарии к посту с поддержкой пагинации.
    Возвращает корневые комментарии + preview дочерних.
    """
    try:
        cl = _make_client(data.session_data)

        params = {
            "can_support_threading": "true",
            "analytics_module": "comments_v2_feed_contextual_self_profile",
        }
        if data.min_id:
            params["min_id"] = data.min_id

        result = cl.private_request(
            f"media/{data.media_pk}/comments/",
            params=params,
        )

        comments = []
        for raw_comment in result.get("comments", []):
            comments.append(_serialize_comment(raw_comment))

        # Курсор пагинации
        next_min_id = None
        if result.get("has_more_headload_comments"):
            next_min_id = result.get("next_min_id")

        comment_count = result.get("comment_count", 0)

        return FetchCommentsResponse(
            success=True,
            comments=comments,
            next_min_id=next_min_id,
            comment_count=comment_count,
        )
    except Exception as e:
        code = error_to_code(e)
        return JSONResponse(
            status_code=code,
            content={"success": False, "error": str(e)},
        )
```

**Файл:** `python-service/helpers.py` — добавить `_serialize_comment()`

```python
def _serialize_comment(raw: dict) -> dict:
    """Сериализует raw-комментарий из Instagram API."""
    user = raw.get("user", {})
    created_at_raw = raw.get("created_at_utc") or raw.get("created_at", 0)
    created_at = (
        datetime.datetime.fromtimestamp(created_at_raw, tz=datetime.timezone.utc).isoformat()
        if isinstance(created_at_raw, (int, float)) and created_at_raw
        else str(created_at_raw)
    )

    preview_children = []
    for child in raw.get("preview_child_comments", []):
        preview_children.append(_serialize_comment(child))

    return {
        "pk": str(raw.get("pk", "")),
        "text": raw.get("text", ""),
        "created_at_utc": created_at,
        "like_count": raw.get("comment_like_count", 0),
        "has_liked": bool(raw.get("has_liked_comment", False)),
        "replied_to_comment_id": str(raw["replied_to_comment_id"]) if raw.get("replied_to_comment_id") else None,
        "child_comment_count": raw.get("child_comment_count", 0),
        "user": {
            "pk": str(user.get("pk", "")),
            "username": user.get("username", ""),
            "full_name": user.get("full_name", ""),
            "profile_pic_url": user.get("profile_pic_url"),
        },
        "preview_child_comments": preview_children,
    }
```

### Шаг 2: Python — endpoint для загрузки replies (дочерних комментариев)

**Файл:** `python-service/schemas.py`

```python
class FetchCommentRepliesRequest(BaseModel):
    session_data: str
    media_pk: str
    comment_pk: str
    min_id: Optional[str] = None  # курсор для пагинации replies

class FetchCommentRepliesResponse(BaseModel):
    success: bool
    child_comments: list
    next_min_id: Optional[str]
    child_comment_count: int
```

**Файл:** `python-service/main.py`

```python
@app.post("/media/comments/replies")
def fetch_comment_replies(data: FetchCommentRepliesRequest):
    """
    Загружает дочерние комментарии (replies) конкретного комментария.
    """
    try:
        cl = _make_client(data.session_data)

        params = {}
        if data.min_id:
            params["min_id"] = data.min_id

        result = cl.private_request(
            f"media/{data.media_pk}/comments/{data.comment_pk}/child_comments/",
            params=params,
        )

        child_comments = []
        for raw in result.get("child_comments", []):
            child_comments.append(_serialize_comment(raw))

        next_min_id = None
        if result.get("has_more_tail_child_comments"):
            next_min_id = result.get("next_max_child_cursor")

        return FetchCommentRepliesResponse(
            success=True,
            child_comments=child_comments,
            next_min_id=next_min_id,
            child_comment_count=result.get("child_comment_count", 0),
        )
    except Exception as e:
        code = error_to_code(e)
        return JSONResponse(
            status_code=code,
            content={"success": False, "error": str(e)},
        )
```

### Шаг 3: Laravel — контроллер и сервис

**Файл:** `backend-laravel/app/Services/InstagramClientServiceInterface.php`

Добавить методы:
```php
public function fetchMediaComments(
    string $sessionData,
    int $accountId,
    string $mediaPk,
    int $amount = 20,
    ?string $minId = null
): array;

public function fetchCommentReplies(
    string $sessionData,
    int $accountId,
    string $mediaPk,
    string $commentPk,
    ?string $minId = null
): array;
```

**Файл:** `backend-laravel/app/Services/InstagramClientService.php`

Реализовать методы — POST к Python:
```php
public function fetchMediaComments(
    string $sessionData,
    int $accountId,
    string $mediaPk,
    int $amount = 20,
    ?string $minId = null
): array {
    $payload = [
        'session_data' => $sessionData,
        'media_pk' => $mediaPk,
        'amount' => $amount
    ];
    $minId !== null && $payload['min_id'] = $minId;

    $response = Http::timeout(30)
        ->post("{$this->pythonUrl}/media/comments", $payload);

    $this->activityLogger->log($accountId, 'fetch_comments', ...);

    return $response->json();
}
```

**Файл:** `backend-laravel/app/Http/Controllers/CommentController.php`

Добавить методы:
```php
public function index(Request $request): JsonResponse
{
    $request->validate([
        'account_id' => 'required|integer|exists:instagram_accounts,id',
        'media_pk' => 'required|string',
        'amount' => 'integer|min:1|max:50',
        'min_id' => 'nullable|string'
    ]);

    $account = InstagramAccount::findOrFail($request->account_id);
    $this->authorize('view', $account);

    $result = $this->instagramClient->fetchMediaComments(
        $account->session_data,
        $account->id,
        $request->media_pk,
        $request->integer('amount', 20),
        $request->min_id
    );

    return response()->json(['success' => true, 'data' => $result]);
}

public function replies(Request $request): JsonResponse
{
    $request->validate([
        'account_id' => 'required|integer|exists:instagram_accounts,id',
        'media_pk' => 'required|string',
        'comment_pk' => 'required|string',
        'min_id' => 'nullable|string'
    ]);

    $account = InstagramAccount::findOrFail($request->account_id);

    $result = $this->instagramClient->fetchCommentReplies(
        $account->session_data,
        $account->id,
        $request->media_pk,
        $request->comment_pk,
        $request->min_id
    );

    return response()->json(['success' => true, 'data' => $result]);
}
```

**Файл:** `backend-laravel/routes/api.php`

```php
Route::get('/media/comments', [CommentController::class, 'index']);
Route::get('/media/comments/replies', [CommentController::class, 'replies']);
```

### Шаг 4: Frontend — типы

**Файл:** `frontend-vue/src/entities/media-post/model/apiTypes.ts`

```typescript
export interface CommentUserApi {
  pk: string
  username: string
  full_name: string
  profile_pic_url: Nullable<string>
}

export interface CommentApi {
  pk: string
  text: string
  created_at_utc: string
  like_count: number
  has_liked: boolean
  replied_to_comment_id: Nullable<string>
  child_comment_count: number
  user: CommentUserApi
  preview_child_comments: CommentApi[]
}

export interface FetchCommentsResponseApi {
  comments: CommentApi[]
  next_min_id: Nullable<string>
  comment_count: number
}

export interface FetchCommentRepliesResponseApi {
  child_comments: CommentApi[]
  next_min_id: Nullable<string>
  child_comment_count: number
}
```

**Файл:** `frontend-vue/src/entities/media-post/model/types.ts`

```typescript
export interface CommentUser {
  pk: string
  username: string
  fullName: string
  profilePicUrl: Nullable<string>
}

export interface PostComment {
  pk: string
  text: string
  createdAtUtc: string
  likeCount: number
  hasLiked: boolean
  repliedToCommentId: Nullable<string>
  childCommentCount: number
  user: CommentUser
  previewChildComments: PostComment[]
  // Локальные поля (не из API):
  childComments?: PostComment[]       // загруженные replies (расширяются кнопкой)
  childCommentsLoading?: boolean
  childCommentsCursor?: Nullable<string>
}
```

### Шаг 5: Frontend — DTO

**Файл:** `frontend-vue/src/entities/media-post/model/mediaPostDTO.ts`

Добавить методы:
```typescript
toLocalCommentUser(data: CommentUserApi): CommentUser {
  return {
    pk: data.pk,
    username: data.username,
    fullName: data.full_name,
    profilePicUrl: proxyImageUrl(data.profile_pic_url)
  }
}

toLocalComment(data: CommentApi): PostComment {
  return {
    pk: data.pk,
    text: data.text,
    createdAtUtc: data.created_at_utc,
    likeCount: data.like_count,
    hasLiked: data.has_liked,
    repliedToCommentId: data.replied_to_comment_id,
    childCommentCount: data.child_comment_count,
    user: this.toLocalCommentUser(data.user),
    previewChildComments: data.preview_child_comments.map(
      (child) => this.toLocalComment(child)
    )
  }
}

toLocalComments(data: CommentApi[]): PostComment[] {
  return data.map((comment) => this.toLocalComment(comment))
}
```

### Шаг 6: Frontend — store (методы для комментариев)

Добавить в `searchStore` (или создать отдельный `commentStore`; рекомендуется отдельный, т.к. комментарии используются и в Feed, и в Search):

**Файл:** `frontend-vue/src/entities/media-post/model/commentStore.ts` (новый)

```typescript
export const useCommentStore = defineStore('comments', () => {
  const comments = ref<PostComment[]>([])
  const commentsCursor = ref<Nullable<string>>(null)
  const commentCount = ref(0)

  const fetchCommentsApi = useApi<...>(...)
  const fetchRepliesApi = useApi<...>(...)

  const fetchComments = async (accountId: number, mediaPk: string) => {
    comments.value = []
    commentsCursor.value = null
    const { data } = await fetchCommentsApi.execute({ accountId, mediaPk, amount: 20 })
    comments.value = mediaPostDTO.toLocalComments(data.comments)
    commentsCursor.value = data.next_min_id ?? null
    commentCount.value = data.comment_count
  }

  const loadMoreComments = async (accountId: number, mediaPk: string) => {
    if (!commentsCursor.value) return
    const { data } = await fetchCommentsApi.execute({
      accountId, mediaPk, amount: 20, minId: commentsCursor.value
    })
    comments.value = [...comments.value, ...mediaPostDTO.toLocalComments(data.comments)]
    commentsCursor.value = data.next_min_id ?? null
  }

  const fetchReplies = async (accountId: number, mediaPk: string, commentPk: string) => {
    const { data } = await fetchRepliesApi.execute({ accountId, mediaPk, commentPk })
    // Найти родительский комментарий и обновить его childComments
    const parent = comments.value.find((c) => c.pk === commentPk)
    if (parent) {
      parent.childComments = mediaPostDTO.toLocalComments(data.child_comments)
      parent.childCommentsCursor = data.next_min_id ?? null
    }
  }

  const clearComments = () => {
    comments.value = []
    commentsCursor.value = null
    commentCount.value = 0
  }

  return { comments, commentsCursor, commentCount, fetchComments, loadMoreComments, fetchReplies, clearComments, ... }
})
```

### Шаг 7: Frontend — UI компонент CommentList

**Файл:** `frontend-vue/src/features/post-detail/ui/CommentList.vue` (новый)

Компонент отображает список комментариев с вложенностью.

**Props:**
```typescript
interface CommentListProps {
  comments: PostComment[]
  loading: boolean
  canLoadMore: boolean
  loadMoreLoading: boolean
}
```

**Emits:**
```typescript
defineEmits(['loadMore', 'loadReplies', 'openUser'])
```

**Шаблон (концепт):**
```html
<template>
  <div class="comment-list">
    <div v-if="loading" class="comment-list__loading">
      <q-spinner size="24px" color="primary" />
    </div>

    <div v-else-if="comments.length === 0" class="comment-list__empty">
      Нет комментариев
    </div>

    <template v-else>
      <div v-for="comment in comments" :key="comment.pk" class="comment-item">
        <!-- Основной комментарий -->
        <div class="comment-item__main">
          <q-avatar size="28px" @click="emit('openUser', comment.user.pk)">
            <img v-if="comment.user.profilePicUrl" :src="comment.user.profilePicUrl" />
            <q-icon v-else name="person" />
          </q-avatar>
          <div class="comment-item__body">
            <span class="comment-item__username">{{ comment.user.username }}</span>
            <span class="comment-item__text">{{ comment.text }}</span>
            <div class="comment-item__meta">
              <span>{{ formatTimeAgo(comment.createdAtUtc) }}</span>
              <span v-if="comment.likeCount > 0">
                <q-icon name="favorite" size="12px" /> {{ comment.likeCount }}
              </span>
            </div>
          </div>
        </div>

        <!-- Preview дочерних комментариев -->
        <div v-if="comment.previewChildComments.length > 0 || comment.childComments?.length"
             class="comment-item__replies">
          <!-- Показать загруженные replies -->
          <div v-for="reply in (comment.childComments || comment.previewChildComments)"
               :key="reply.pk"
               class="comment-item comment-item--reply">
            <!-- Тот же шаблон, но с отступом -->
          </div>

          <!-- Кнопка "Загрузить ответы" -->
          <button
            v-if="comment.childCommentCount > (comment.childComments?.length || comment.previewChildComments.length)"
            class="comment-item__load-replies"
            @click="emit('loadReplies', comment.pk)"
          >
            Показать ответы ({{ comment.childCommentCount }})
          </button>
        </div>
      </div>

      <!-- Кнопка "Загрузить ещё" для корневых комментариев -->
      <ButtonComponent
        v-if="canLoadMore"
        label="Загрузить ещё"
        flat
        dense
        color="primary"
        :loading="loadMoreLoading"
        @click="emit('loadMore')"
      />
    </template>
  </div>
</template>
```

### Шаг 8: Интеграция в PostDetailModal

**Файл:** `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue`

Добавить CommentList между описанием и секцией actions/comment-input:

```html
<!-- После meta, перед bottom-section -->
<CommentList
  :comments="commentStore.comments"
  :loading="commentStore.commentsLoading"
  :can-load-more="commentStore.canLoadMore"
  :load-more-loading="commentStore.loadMoreLoading"
  @load-more="loadMoreCommentsHandler"
  @load-replies="loadRepliesHandler"
  @open-user="openCommentUserHandler"
/>
```

**Загрузка при открытии/смене поста:**
```typescript
watch(() => props.post.pk, (newPk) => {
  accountId && commentStore.fetchComments(accountId, newPk)
}, { immediate: true })

watch(isOpen, (opened) => {
  !opened && commentStore.clearComments()
})
```

## Структура файлов

### Новые файлы

| Файл | Описание |
|------|----------|
| `python-service/main.py` | Endpoints `/media/comments` и `/media/comments/replies` |
| `python-service/helpers.py` | Функция `_serialize_comment()` |
| `python-service/schemas.py` | Request/Response схемы |
| `frontend-vue/src/entities/media-post/model/commentStore.ts` | Pinia store для комментариев |
| `frontend-vue/src/features/post-detail/ui/CommentList.vue` | UI-компонент списка комментариев |

### Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `backend-laravel/app/Services/InstagramClientServiceInterface.php` | 2 новых метода |
| `backend-laravel/app/Services/InstagramClientService.php` | Реализация 2 методов |
| `backend-laravel/app/Http/Controllers/CommentController.php` | 2 новых метода (index, replies) |
| `backend-laravel/routes/api.php` | 2 новых роута |
| `frontend-vue/src/entities/media-post/model/apiTypes.ts` | Типы CommentApi, FetchCommentsResponseApi |
| `frontend-vue/src/entities/media-post/model/types.ts` | Типы PostComment, CommentUser |
| `frontend-vue/src/entities/media-post/model/mediaPostDTO.ts` | Методы toLocalComment* |
| `frontend-vue/src/entities/media-post/index.ts` | Реэкспорт commentStore |
| `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue` | Интеграция CommentList |

## Верификация данных (DEBUG_PROTOCOL)

### 1. Проверить raw response Instagram для комментариев

```bash
# Найти media_pk поста с комментариями (из ленты или поиска)
# Допустим media_pk = 3456789012345

jq -n --arg sd "$(cat _TEST/session.json)" \
  '{session_data: $sd, media_pk: "3456789012345", amount: 5}' | \
curl -s -X POST http://localhost:8001/media/comments \
  -H "Content-Type: application/json" \
  -d @- | jq . > _TEST/01_python_comments.json
```

### 2. Проверить структуру комментария

```bash
jq '.comments[0] | keys' _TEST/01_python_comments.json
# Ожидается: pk, text, user, created_at_utc, like_count, has_liked,
#            child_comment_count, preview_child_comments, replied_to_comment_id

jq '.comments[0].preview_child_comments | length' _TEST/01_python_comments.json
# Если > 0 — превью дочерних комментариев доступны
```

### 3. Проверить загрузку replies

```bash
# Взять pk комментария с child_comment_count > 0
COMMENT_PK=$(jq -r '[.comments[] | select(.child_comment_count > 0)][0].pk' _TEST/01_python_comments.json)

jq -n --arg sd "$(cat _TEST/session.json)" --arg cpk "$COMMENT_PK" \
  '{session_data: $sd, media_pk: "3456789012345", comment_pk: $cpk}' | \
curl -s -X POST http://localhost:8001/media/comments/replies \
  -H "Content-Type: application/json" \
  -d @- | jq . > _TEST/01_python_comment_replies.json
```

## Тестирование

1. Открыть пост с комментариями → комментарии загрузились (мин. 15 или сколько есть)
2. Прокрутить вниз → кнопка «Загрузить ещё» → новые комментарии появляются
3. Комментарий с ответами → видны preview replies с отступом
4. Кнопка «Показать ответы (N)» → загружаются все replies
5. Пост без комментариев → текст «Нет комментариев»
6. Переключение между постами в модалке → комментарии перезагружаются
7. Закрытие модалки → комментарии очищаются

## Примечания

- `media_pk` — числовой PK поста. Не путать с `media_id` (`{media_pk}_{user_pk}`). Для загрузки комментариев Instagram API принимает `media_pk`, а не `media_id`.
- Поле `created_at_utc` в raw Instagram response — unix timestamp, не ISO. `_serialize_comment()` конвертирует.
- Поля `comment_like_count` и `has_liked_comment` в raw response — маппятся в `like_count` и `has_liked`.
- Rate limit: загрузка комментариев — безопасная операция (read-only), но частые запросы всё равно могут вызвать throttle. При ошибке — показывать уведомление.
