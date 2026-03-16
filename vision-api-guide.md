# Vision API: GLM и OpenAI — полная инструкция

> Актуально на март 2026. Источники: [Z.ai API Docs](https://docs.z.ai/guides/vlm/glm-4.6v) · [Z.ai API Reference](https://docs.z.ai/api-reference/llm/chat-completion) · [OpenAI API Docs](https://platform.openai.com/docs/guides/vision)

---

## Часть 1 — GLM (Z.ai / Zhipu AI)

### 1.1 Актуальные vision-модели

| Модель | Параметры | Контекст | Назначение |
|---|---|---|---|
| `glm-4.6v` | 106B | 128K | Flagship, облако |
| `glm-4.6v-flashx` | — | 128K | Быстрый, платный |
| `glm-4.6v-flash` | 9B | 128K | Бесплатный, low-latency |
| `glm-4.5v` | 106B-A12B | 66K | Предыдущее поколение |

Все модели принимают: изображения, видео, документы, текст.  
Поддерживают нативный Function Calling с мультимодальными входами.

---

### 1.2 Endpoint

```
POST https://api.z.ai/api/paas/v4/chat/completions
```

**Заголовки:**
```http
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

---

### 1.3 Отправка изображения + промпт (по URL)

```javascript
const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "glm-4.6v",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: "https://example.com/photo.jpg"
            }
          },
          {
            type: "text",
            text: "Посмотри на картинку. Если там изображён человек — сделай комплимент."
          }
        ]
      }
    ],
    thinking: { type: "disabled" }  // "enabled" для глубоких рассуждений
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

---

### 1.4 Отправка изображения + промпт (base64)

```python
import base64, requests

with open("photo.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

payload = {
    "model": "glm-4.6v",
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{b64}"
                    }
                },
                {
                    "type": "text",
                    "text": "Посмотри на картинку. Если там изображён человек — сделай комплимент."
                }
            ]
        }
    ],
    "thinking": {"type": "disabled"}
}

headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

res = requests.post(
    "https://api.z.ai/api/paas/v4/chat/completions",
    json=payload,
    headers=headers
)
print(res.json()["choices"][0]["message"]["content"])
```

---

### 1.5 Через официальный Python SDK

```bash
pip install zhipuai
```

```python
from zhipuai import ZhipuAI

client = ZhipuAI(api_key="YOUR_API_KEY")

response = client.chat.completions.create(
    model="glm-4.6v",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.com/photo.jpg"
                    }
                },
                {
                    "type": "text",
                    "text": "Посмотри на картинку. Если там изображён человек — сделай комплимент."
                }
            ]
        }
    ],
    thinking={"type": "disabled"}
)

print(response.choices[0].message.content)
```

---

### 1.6 Параметры thinking

| Значение | Поведение |
|---|---|
| `"enabled"` | Модель рассуждает перед ответом (медленнее, точнее) |
| `"disabled"` | Прямой ответ без CoT (быстрее) |

При `enabled` в ответе появляется поле `reasoning_content` с цепочкой рассуждений.

---

### 1.7 Структура ответа

```json
{
  "id": "...",
  "model": "glm-4.6v",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Текст ответа модели",
        "reasoning_content": "...(только при thinking: enabled)"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 512,
    "completion_tokens": 64,
    "total_tokens": 576
  }
}
```

---

## Часть 2 — OpenAI

### 2.1 Актуальные vision-модели

| Модель | Контекст | Назначение |
|---|---|---|
| `gpt-4o` | 128K | Flagship, лучшее качество |
| `gpt-4o-mini` | 128K | Дешевле, быстрее |
| `gpt-4.1` | 1M | Новейший, длинный контекст |
| `gpt-4.1-mini` | 1M | Облегчённый вариант gpt-4.1 |

Все модели принимают изображения нативно — никаких отдельных vision-endpoint не нужно.

---

### 2.2 Endpoint

```
POST https://api.openai.com/v1/chat/completions
```

**Заголовки:**
```http
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

---

### 2.3 Отправка изображения + промпт (по URL)

```javascript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: "https://example.com/photo.jpg",
              detail: "auto"  // "low" | "high" | "auto"
            }
          },
          {
            type: "text",
            text: "Посмотри на картинку. Если там изображён человек — сделай комплимент."
          }
        ]
      }
    ],
    max_tokens: 512
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

---

### 2.4 Отправка изображения + промпт (base64)

```python
import base64, requests

with open("photo.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

payload = {
    "model": "gpt-4o",
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{b64}",
                        "detail": "auto"
                    }
                },
                {
                    "type": "text",
                    "text": "Посмотри на картинку. Если там изображён человек — сделай комплимент."
                }
            ]
        }
    ],
    "max_tokens": 512
}

headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

res = requests.post(
    "https://api.openai.com/v1/chat/completions",
    json=payload,
    headers=headers
)
print(res.json()["choices"][0]["message"]["content"])
```

---

### 2.5 Через официальный Python SDK

```bash
pip install openai
```

```python
from openai import OpenAI

client = OpenAI(api_key="YOUR_API_KEY")

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.com/photo.jpg",
                        "detail": "auto"
                    }
                },
                {
                    "type": "text",
                    "text": "Посмотри на картинку. Если там изображён человек — сделай комплимент."
                }
            ]
        }
    ],
    max_tokens=512
)

print(response.choices[0].message.content)
```

---

### 2.6 Параметр `detail`

| Значение | Поведение | Стоимость |
|---|---|---|
| `"auto"` | Модель сама выбирает | Зависит от размера |
| `"low"` | Быстро, грубо, 85 токенов на изображение | Дёшево |
| `"high"` | Детальный анализ, тайлы 512×512 | Дорого |

---

### 2.7 Несколько изображений в одном запросе

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": "https://example.com/img1.jpg"}},
                {"type": "image_url", "image_url": {"url": "https://example.com/img2.jpg"}},
                {"type": "text", "text": "Сравни эти два изображения."}
            ]
        }
    ],
    max_tokens=512
)
```

---

### 2.8 Структура ответа

```json
{
  "id": "chatcmpl-...",
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Текст ответа модели"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 1024,
    "completion_tokens": 64,
    "total_tokens": 1088
  }
}
```

---

## Часть 3 — Сравнение GLM vs OpenAI Vision

| Параметр | GLM-4.6V (Z.ai) | GPT-4o (OpenAI) |
|---|---|---|
| Официальный hosted API | ✅ Да | ✅ Да |
| Контекст | 128K токенов | 128K (gpt-4o) / 1M (gpt-4.1) |
| Нативный Function Calling | ✅ Да | ✅ Да |
| Открытый исходный код | ✅ MIT | ❌ Закрытый |
| Простота интеграции | Высокая | Высокая |
| Несколько изображений | ✅ Да | ✅ Да |
| Форматы изображений | JPEG, PNG, WEBP, видео | JPEG, PNG, WEBP, GIF |
| Бесплатный тариф | ✅ glm-4.6v-flash | ❌ Только пробные кредиты |

---

## Поддерживаемые форматы изображений

- `image/jpeg` — `.jpg`, `.jpeg`
- `image/png` — `.png`
- `image/webp` — `.webp`
- `image/gif` — `.gif` (только GLM)

Максимальный размер: рекомендуется не более **5 МБ** на изображение.  
Для base64 — конвертировать файл в строку и передавать через `data:image/jpeg;base64,...`

---

## Ссылки на документацию

- **GLM-4.6V гайд**: https://docs.z.ai/guides/vlm/glm-4.6v
- **GLM Chat Completion API**: https://docs.z.ai/api-reference/llm/chat-completion
- **GLM API Keys**: https://z.ai/manage-apikey/apikey-list
- **OpenAI Vision Guide**: https://platform.openai.com/docs/guides/vision
- **OpenAI API Reference**: https://platform.openai.com/docs/api-reference/chat
- **OpenAI API Keys**: https://platform.openai.com/api-keys
- **OpenAI Pricing**: https://openai.com/api/pricing
