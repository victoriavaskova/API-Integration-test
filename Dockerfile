# Этап 1: Сборка приложения
# Используем стабильный образ Node.js 18 на базе Alpine Linux для легковесности
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json из директории server
COPY server/package*.json ./

# Устанавливаем зависимости
# Используем --only=production для установки только production-зависимостей, если это необходимо
RUN npm install

# Копируем все исходные файлы сервера
COPY server/ ./

# Компилируем TypeScript в JavaScript
# Команда 'build' должна быть определена в package.json (tsc)
RUN npm run build


# Этап 2: Production-окружение
# Используем тот же базовый образ для консистентности
FROM node:18-alpine

WORKDIR /usr/src/app

# Устанавливаем переменную окружения для Node.js, чтобы указать, что это production
ENV NODE_ENV=production

# Копируем скомпилированное приложение из этапа сборки
COPY --from=builder /usr/src/app/dist ./dist

# Копируем production-зависимости из этапа сборки
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Копируем package.json для запуска
COPY --from=builder /usr/src/app/package.json ./

# Prisma: Копируем схему для генерации Prisma Client
COPY server/prisma/schema.prisma ./prisma/

# Генерируем Prisma Client для production-окружения
# Это важно, так как бинарные файлы могут отличаться между ОС (например, macOS и Linux)
RUN npx prisma generate

# Открываем порт, на котором будет работать приложение
EXPOSE 3003

# Команда для запуска приложения
# Запускаем скомпилированный app.js из директории dist
CMD ["node", "dist/app.js"] 