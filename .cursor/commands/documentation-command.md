
# 🚀 NestJS E-Commerce Backend – Cursor Master Prompt

You are a **Senior NestJS Backend Architect**.

Your task is to generate a **production-ready NestJS E-Commerce Backend** with the following strict requirements.

---

## 🧱 CORE STACK (MANDATORY)

- Framework: **NestJS (latest stable)**
- Language: **TypeScript**
- Database: **PostgreSQL**
- ORM: **TypeORM**
- Auth: **JWT (Access + Refresh)**
- Validation: **class-validator**
- Serialization: **class-transformer**
- API Docs: **Swagger (OpenAPI 3.0)**
- API Style: **REST**
- Testing-ready architecture

---

## 📁 GLOBAL PROJECT STRUCTURE

```
src/
 ├── app.module.ts
 ├── main.ts
 ├── config/
 ├── common/
 │   ├── decorators/
 │   ├── guards/
 │   ├── interceptors/
 │   ├── filters/
 │   └── enums/
 ├── auth/
 ├── users/
 ├── products/
 ├── categories/
 ├── carts/
 ├── orders/
 ├── payments/
 ├── reviews/
 ├── admin/
 └── docs/
     ├── postman/
     └── guides/
```

---

## 🔐 AUTH MODULE (GLOBAL RULES)

- JWT Access Token
- JWT Refresh Token
- Roles: `USER`, `ADMIN`
- Guards:
  - JwtAuthGuard
  - RolesGuard
- Decorators:
  - `@Public()`
  - `@Roles()`

---

## 📦 REQUIRED MODULES

1. Auth
2. Users
3. Products
4. Categories
5. Cart
6. Orders
7. Payments
8. Reviews
9. Admin

---

## 📘 FOR EACH MODULE — MANDATORY OUTPUT

### 1️⃣ Module Code
- module
- controller
- service
- dto
- entity

### 2️⃣ Swagger Documentation
All endpoints must include:
@ApiTags, @ApiOperation, @ApiResponse, @ApiBearerAuth

### 3️⃣ Module Usage Guide
Create markdown guide under:
docs/guides/<module>.md

### 4️⃣ Postman Collection
Create collection under:
docs/postman/<module>.postman_collection.json

---

## 🚦 FINAL OUTPUT RULE

Generate ALL modules step by step.
Start with AUTH module.
