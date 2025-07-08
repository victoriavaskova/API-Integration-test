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
## Технологический стек

-   **Фреймворк**: Express
-   **Язык**: TypeScript
-   **База данных**: PostgreSQL
-   **ORM**: Prisma
-   **Контейнеризация**: Docker, Docker Compose
-   **Логирование**: Winston


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

## 📚 Документация

- **📖 API Документация**: http://localhost:3003/api-docs (Swagger UI)
- **🔧 Техническая документация**: [server/README.md](server/README.md)
- **🗄️ База данных**: [server/DATABASE_SETUP.md](server/DATABASE_SETUP.md)

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
