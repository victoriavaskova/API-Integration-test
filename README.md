# Сервис Интеграции с Платформой Ставок

Этот сервис является бэкенд-компонентом, который выступает в роли промежуточного слоя между клиентскими приложениями и внешним API платформы ставок. Он обеспечивает аутентификацию, управление пользователями, ставками, балансом, а также предоставляет расширенную функциональность, такую как админ-панель и надежное хранение данных.

## 🌟 Что это такое?

Проект построен на основе слоеной архитектуры (Layered Architecture), что обеспечивает четкое разделение ответственности, высокую поддерживаемость и масштабируемость кода.

### ✨ Основные возможности

- **🔐 Безопасная аутентификация** - JWT токены и защищенные API
- **💰 Управление балансом** - Отслеживание средств в реальном времени
- **🎲 Система ставок** - Полный цикл размещения и обработки ставок
- **📊 История операций** - Детальная история всех транзакций
- **🛡️ Надежность** - Обработка ошибок и механизмы повторных попыток
- **📱 Admin Panel** - Веб-интерфейс для управления системой
- **🚀 Production Ready** - Docker, мониторинг, логирование

## 🏗️ Архитектура проекта

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  Backend API    │───▶│  External API   │
│  (React/Vue)    │    │   (Express)     │    │  (Betting API)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │    Database     │
                       └─────────────────┘
```

### Быстрый старт:

### Шаг 1: Клонирование проекта

```bash
git clone <repository-url>
cd API-Integration-test
```

### Шаг 2: Настройка окружения

```bash
# Копируем файл конфигурации
cp server/.env.example server/.env

# Редактируем файл server/.env - укажите ваши данные
```

### Шаг 3: Запуск с Docker (рекомендуется)

```bash
# Запуск всей системы одной командой
docker-compose up --build

# Система будет доступна по адресу:
# - API: http://localhost:3003
# - Swagger Docs: http://localhost:3003/api-docs
# - Admin Panel: http://localhost:3003/admin
```

### Шаг 4: Настройка базы данных

```bash
# Применяем миграции
docker-compose exec server npx prisma migrate deploy

# Заполняем тестовыми данными
docker-compose exec server npm run db:seed
```

## Технологический стек

-   **Фреймворк**: Express
-   **Язык**: TypeScript
-   **База данных**: PostgreSQL
-   **ORM**: Prisma
-   **Контейнеризация**: Docker, Docker Compose
-   **Логирование**: Winston

## Запуск и Развертывание

### Требования
-   Node.js v18+
-   Docker и Docker Compose

### 1. Локальный запуск (для разработки)

**Настройка окружения:**

1.  Скопируйте файл `.env.example` в `.env` в директории `server/`:
    ```bash
    cp server/.env.example server/.env
    ```
2.  Заполните переменные в `server/.env`. Укажите данные для подключения к вашей локальной базе данных PostgreSQL, а также `EXTERNAL_USER_ID` и `EXTERNAL_SECRET_KEY` для внешнего API.

## 📚 Документация

- **📖 API Документация**: http://localhost:3003/api-docs (Swagger UI)
- **🔧 Техническая документация**: [server/README.md](server/README.md)
- **🗄️ База данных**: [server/DATABASE_SETUP.md](server/DATABASE_SETUP.md)

## 🧪 Тестирование

```bash
# Запуск всех тестов
npm test --prefix server

# Запуск с покрытием кода
npm run test:coverage --prefix server

# Запуск в режиме наблюдения
npm run test:watch --prefix server
```

## 🏢 Структура проекта

```
API-Integration-test/
├── client/                 # Frontend приложение (React)
│   ├── src/
│   │   ├── pages/         # Страницы приложения
│   │   ├── shared/        # Общие компоненты
│   │   └── widgets/       # UI виджеты
│   └── package.json
├── server/                # Backend API (Express + TypeScript)
│   ├── src/
│   │   ├── controllers/   # HTTP контроллеры
│   │   ├── services/      # Бизнес-логика
│   │   ├── repositories/  # Слой данных
│   │   ├── middleware/    # Express middleware
│   │   └── routes/        # API маршруты
│   ├── prisma/           # База данных
│   └── tests/            # Тесты
├── docker-compose.yml    # Конфигурация Docker
└── README.md            # Этот файл
```

### Полезные команды

```bash
# База данных
npm run db:studio --prefix server     # Prisma Studio
npm run db:migrate --prefix server    # Применить миграции
npm run db:seed --prefix server       # Заполнить тестовыми данными

# Качество кода
npm run lint --prefix server          # Проверка ESLint
npm run type-check --prefix server    # Проверка TypeScript
```


1.  **Настройка окружения:**
    -   Убедитесь, что у вас создан и заполнен файл `server/.env`, как описано выше. `docker-compose` будет использовать его для конфигурации контейнеров.
    -   Убедитесь, что Docker запущен.

2.  **Сборка и запуск контейнеров:**
    Выполните команду в корневой директории проекта:
    ```bash
    docker-compose up --build
    ```
    Эта команда соберет образ для сервера, скачает образ PostgreSQL и запустит оба контейнера. Чтобы запустить в фоновом режиме, добавьте флаг `-d`.

3.  **Применение миграций в Docker:**
    Когда контейнеры запущены, откройте новый терминал и выполните:
    ```bash
    docker-compose exec server npx prisma migrate deploy
    ```

4.  **Остановка:**
    Для остановки контейнеров выполните:
    ```bash
    docker-compose down
    ```
