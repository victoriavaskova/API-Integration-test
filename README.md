# Сервис Интеграции с Платформой Ставок

Этот сервис является бэкенд-компонентом, который выступает в роли промежуточного слоя между клиентскими приложениями и внешним API платформы ставок. Он обеспечивает аутентификацию, управление пользователями, ставками, балансом, а также предоставляет расширенную функциональность, такую как админ-панель и надежное хранение данных.

## Архитектура Решения

Проект построен на основе слоеной архитектуры (Layered Architecture), что обеспечивает четкое разделение ответственности, высокую поддерживаемость и масштабируемость кода.

```mermaid
graph TD
    A[Client Application] --> B{Express Server};
    B --> C[Middleware];
    C --> D[API Routes];
    D --> E[Controllers];
    E --> F[Services];
    F --> G[Repositories];
    G --> H[Prisma ORM];
    H --> I[(PostgreSQL DB)];
    
    F --> J[External API Client];
    J --> K[Betting Provider API];

    subgraph "Application"
        B; C; D; E; F; G; H; J;
    end

    style B fill:#f9f,stroke:#333,stroke-width:2px
    style E fill:#ccf,stroke:#333,stroke-width:2px
    style F fill:#9cf,stroke:#333,stroke-width:2px
    style G fill:#9fc,stroke:#333,stroke-width:2px
]

-   **Controllers**: Отвечают за обработку HTTP-запросов, валидацию входящих данных и вызов соответствующего сервиса.
-   **Services**: Содержат основную бизнес-логику приложения. Они оркестрируют вызовы репозиториев и внешних API.
-   **Repositories**: Абстрагируют логику доступа к данным. Вся работа с базой данных (через Prisma) инкапсулирована здесь.
-   **External API Client**: Специализированный клиент для взаимодействия с внешним API платформы ставок.

### Последовательная диаграмма: Размещение ставки

Эта диаграмма иллюстрирует полный цикл размещения ставки, реализованный в сервисе.

```mermaid
sequenceDiagram
    participant Client
    participant Server as Betting Service
    participant DB as Local PostgreSQL
    participant ExtAPI as External Betting API

    Client->>+Server: POST /api/bets (amount)
    Server->>+ExtAPI: POST /auth (аутентификация)
    ExtAPI-->>-Server: Auth Success
    
    Server->>+ExtAPI: POST /balance (проверка/установка баланса)
    ExtAPI-->>-Server: { balance: 1000 }
    
    alt Баланс достаточен
        Server->>+ExtAPI: POST /bet (amount)
        ExtAPI-->>-Server: { bet_id: "xyz" }
        
        Server->>+ExtAPI: POST /win (bet_id: "xyz")
        ExtAPI-->>-Server: { win: 6 }
        
        Server->>+ExtAPI: POST /balance (финальная проверка)
        ExtAPI-->>-Server: { balance: 1003 }
        
        Server->>+DB: Сохранить ставку (status: COMPLETED, win: 6)
        DB-->>-Server: Ставка создана
        
        Server->>+DB: Обновить баланс пользователя (1003)
        DB-->>-Server: Баланс обновлен
        
        Server-->>-Client: 201 Created (ставка и результат)
    else Баланс недостаточен
        Server-->>-Client: 400 Bad Request (Insufficient balance)
    end
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

**Установка и запуск:**

1.  **Установите зависимости:**
    ```bash
    npm install --prefix server
    ```
2.  **Примените миграции базы данных:**
    ```bash
    npx prisma migrate dev --schema=./server/prisma/schema.prisma
    ```
3.  **Заполните базу начальными данными (сидирование):**
    ```bash
    npx prisma db seed --schema=./server/prisma/schema.prisma
    ```
4.  **Запустите сервер в режиме разработки:**
    ```bash
    npm run dev --prefix server
    ```

Сервер будет доступен по адресу `http://localhost:3003`.

### 2. Запуск с помощью Docker (для production)

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

## API Документация

Интерактивная документация API доступна через Swagger UI после запуска сервера.
-   **URL**: `http://localhost:3003/api-docs`

## Ключевые эндпоинты

-   `POST /api/auth/login`: Аутентификация пользователя.
-   `POST /api/bets`: Размещение ставки (реализует полный цикл).
-   `GET /api/bets`: Получение истории ставок.
-   `GET /api/balance`: Получение баланса.
-   `GET /admin/stats`: (Только для админов) Получение статистики. 