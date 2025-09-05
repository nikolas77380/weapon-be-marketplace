# S3 Setup для Strapi

Этот документ описывает настройку Amazon S3 для загрузки файлов в Strapi.

## Предварительные требования

1. AWS аккаунт
2. S3 bucket
3. IAM пользователь с необходимыми правами

## Настройка AWS S3

### 1. Создание S3 Bucket

1. Войдите в AWS Console
2. Перейдите в S3
3. Создайте новый bucket
4. Настройте публичный доступ (если нужен)

### 2. Создание IAM пользователя

1. Перейдите в IAM
2. Создайте нового пользователя
3. Прикрепите политику с правами на S3:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

4. Создайте Access Key для пользователя

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта `marketplace-api`:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_ACCESS_SECRET=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_BUCKET=your-s3-bucket-name
AWS_S3_URL=https://your-bucket-name.s3.your-region.amazonaws.com
```

**Примечание:** `AWS_S3_URL` - опциональная переменная. Если она не указана, URL будет автоматически сформирован из `AWS_BUCKET` и `AWS_REGION`.

### 4. Установка пакета

Пакет `@strapi/provider-upload-aws-s3` уже установлен в проекте.

### 5. Конфигурация Strapi

Конфигурация уже настроена в файле `config/plugins.ts`:

```typescript
export default () => ({
  upload: {
    config: {
      provider: "aws-s3",
      providerOptions: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_ACCESS_SECRET,
        region: process.env.AWS_REGION,
        params: {
          ACL: "public-read",
          signUrlExpires: 15 * 60,
          Bucket: process.env.AWS_BUCKET,
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});
```

### 6. Настройка Content Security Policy

В файле `config/middlewares.ts` настроена динамическая конфигурация CSP для S3:

```typescript
"img-src": [
  "'self'",
  "data:",
  "blob:",
  "dl.airtable.com",
  process.env.AWS_S3_URL || `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
],
"media-src": [
  "'self'",
  "data:",
  "blob:",
  "dl.airtable.com",
  process.env.AWS_S3_URL || `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
],
```

## Использование

После настройки все загружаемые файлы будут автоматически сохраняться в S3. Это включает:

- Изображения продуктов
- Сертификаты
- Другие медиа файлы

### Переменные окружения

Убедитесь, что все необходимые переменные окружения установлены в файле `.env`:

- `AWS_ACCESS_KEY_ID` - Access Key ID от AWS IAM пользователя
- `AWS_ACCESS_SECRET` - Secret Access Key от AWS IAM пользователя  
- `AWS_REGION` - Регион AWS (например, `us-east-1`, `eu-north-1`)
- `AWS_BUCKET` - Название S3 bucket
- `AWS_S3_URL` - (опционально) Полный URL к S3 bucket

## Проверка работы

1. Запустите Strapi сервер
2. Попробуйте загрузить файл через админ панель
3. Проверьте, что файл появился в S3 bucket

## Безопасность

- Никогда не коммитьте файл `.env` в репозиторий
- Используйте минимально необходимые права для IAM пользователя
- Регулярно ротируйте Access Keys
- Настройте CORS для bucket если нужно
