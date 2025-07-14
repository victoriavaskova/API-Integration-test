# Настройка базы данных

## Быстрый старт с Docker

1. **Запустите PostgreSQL через Docker Compose:**
   ```bash
   docker-compose up -d
   ```

2. **Создайте файл .env в папке server:**
   ```env
   # Server Configuration
   PORT=3003
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000

   # Database Configuration
   DATABASE_URL="postgresql://postgres:your_password_here@localhost:5432/betting_integration"

   # External API Configuration
   EXTERNAL_API_URL=https://bets.tgapps.cloud/api
   

   # JWT Configuration - MUST be changed in production!
   JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-change-in-production
   JWT_EXPIRES_IN=24h

   # Admin Configuration - MUST be changed in production!
   ADMIN_TOKEN=your-admin-token-minimum-32-characters-change-in-production

   # Logging
   LOG_LEVEL=info
   ```

3. **Выполните миграции:**
   ```bash
   npm run db:migrate
   ```

4. **Заполните базу данных тестовыми данными:**
   ```bash
   npm run db:seed
   ```

## Альтернативная настройка PostgreSQL

### Установка PostgreSQL локально

1. **Установите PostgreSQL:**
   - macOS: `brew install postgresql`
   - Ubuntu: `sudo apt-get install postgresql postgresql-contrib`
   - Windows: Скачайте с официального сайта PostgreSQL

2. **Создайте базу данных:**
   ```sql
   CREATE DATABASE betting_integration;
   CREATE USER betting_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE betting_integration TO betting_user;
   ```

3. **Обновите DATABASE_URL в .env:**
   ```env
   DATABASE_URL="postgresql://betting_user:your_password@localhost:5432/betting_integration"
   ```

## Команды для работы с базой данных

- `npm run db:generate` - генерирует Prisma Client
- `npm run db:migrate` - создаёт и применяет миграции
- `npm run db:seed` - заполняет базу данных тестовыми данными
- `npm run db:reset` - сбрасывает базу данных и применяет миграции заново
- `npm run db:studio` - запускает Prisma Studio для просмотра данных

## Структура базы данных

### Таблицы:
- `users` - пользователи системы
- `external_api_accounts` - данные для интеграции с внешним API
- `bets` - ставки пользователей
- `transactions` - история транзакций
- `api_logs` - логи запросов к внешнему API
- `user_balances` - балансы пользователей

### Тестовые пользователи:
После выполнения `npm run db:seed` будут созданы пользователи:
- `user1` - `user5` (с начальным балансом 1000)
- `admin` (административный пользователь)

## Проверка подключения

Для проверки подключения к базе данных:
```bash
npm run db:studio
```

Откроется Prisma Studio по адресу: http://localhost:5555

## Adminer (опционально)

Если вы используете Docker Compose, то Adminer доступен по адресу: http://localhost:8080

Настройки подключения:
- Система: PostgreSQL
- Сервер: postgres
- Пользователь: postgres
- Пароль: password
- База данных: betting_integration

## Решение проблем

### Ошибка подключения к базе данных
1. Убедитесь, что PostgreSQL запущен
2. Проверьте правильность DATABASE_URL в .env
3. Убедитесь, что база данных создана

### Ошибка миграций
1. Выполните: `npm run db:reset`
2. Затем: `npm run db:seed`

### Ошибка прав доступа
1. Проверьте права пользователя базы данных
2. Убедитесь, что пользователь имеет доступ к базе данных 