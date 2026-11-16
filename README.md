# SIVEP Tech

Base multi-tenant de software a la medida para cuatro oficios: **hoteles, farmacia, veterinaria y tienda de barrio**. Una sola plataforma, cuatro operaciones distintas y datos separados por empresa.

> SIVEP Tech · Sistemas a la medida · Arauca, Colombia

---

## 1. Qué incluye

- **Portal público** con presentación de la base, las cuatro verticales, registro de empresas y acceso a demos.
- **Panel por empresa** con resumen operativo, ventas (POS), clientes, catálogo e inventario.
- **Módulos por vertical**:
  - Hotel: habitaciones, reservas, check-in/check-out y consumos.
  - Farmacia: lotes, vencimientos, alertas de reposición y venta de mostrador.
  - Veterinaria: pacientes (mascotas), tutores, agenda de citas y servicios.
  - Tienda: ventas rápidas, control de stock y resumen del día.
- **Administración**: usuarios con roles, ajustes de identidad, moneda, impuesto, zona horaria y prefijo de comprobante.
- **Aislamiento multi-tenant** verificado en backend, no solo en la interfaz.

## 2. Stack

| Capa             | Tecnología                                          |
| ---------------- | --------------------------------------------------- |
| API              | Node.js · Fastify 5 · Zod                           |
| Datos de empresa | MongoDB 7 · Mongoose                                |
| Datos operativos | MySQL 8 · Knex                                      |
| Autenticación    | JWT · bcrypt                                        |
| Frontend         | React 19 · Vite 6 · React Router 7 · TanStack Query |
| Monorepo         | pnpm workspaces                                     |

### Separación de datos

| MongoDB (cambia poco)           | MySQL (cambia todo el día)               |
| ------------------------------- | ---------------------------------------- |
| Empresa/tenant, estado y plan   | Ventas y movimientos                     |
| Usuarios, roles y credenciales  | Productos, lotes y stock                 |
| Branding, contacto y ajustes    | Clientes y consumos                      |
| Identidad visual y preferencias | Habitaciones, reservas, mascotas y citas |

Cada documento de Mongo lleva `tenantId`; cada tabla operativa de MySQL lleva `tenant_id`. Las consultas siempre filtran por el tenant de la sesión.

## 3. Requisitos

- Node.js 20 o superior
- pnpm 9 o superior (`corepack enable` funciona bien)
- MongoDB 7 y MySQL 8 instalados y en ejecución

## 4. Puesta en marcha

```bash
# 1. Dependencias
pnpm install

# 2. Variables de entorno
cp backend/.env.example backend/.env

# 3. Crea la base y el usuario en MySQL (una sola vez)
#    mysql -u root -p < database.sql

# 4. Esquema y datos de demostración
pnpm migrate
pnpm seed

# 5. API + frontend
pnpm dev
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:4000/api>
- Salud: <http://localhost:4000/api/health>

El frontend usa el proxy de Vite para `/api`, así que no hace falta definir `VITE_API_URL` en desarrollo. Si el puerto 5173 está ocupado, Vite tomará el siguiente y bastará con abrir la URL que imprima en consola.

Antes de `pnpm migrate`, MongoDB debe estar corriendo en `mongodb://127.0.0.1:27017` (Mongoose crea la base sola) y MySQL debe tener la base y el usuario de `database.sql`. Si tus servicios usan otros puertos o credenciales, ajusta `MONGO_URI` y las variables `MYSQL_*` en `backend/.env`; `pnpm migrate`, `pnpm seed` y la API leen ese mismo archivo.

## 5. Cuentas de demostración

Contraseña para todas: **`demo1234`**

| Vertical    | Empresa                   | Identificador      | Correo                   |
| ----------- | ------------------------- | ------------------ | ------------------------ |
| Hotel       | Hotel Casa Bruma          | `demo-hotel`       | `hotel@sivep.tech`       |
| Farmacia    | Farmacia El Roble         | `demo-farmacia`    | `farmacia@sivep.tech`    |
| Veterinaria | Veterinaria Patas & Pulso | `demo-veterinaria` | `veterinaria@sivep.tech` |
| Tienda      | Tienda Doña Rosa          | `demo-tienda`      | `tienda@sivep.tech`      |

El acceso pide **identificador de empresa + correo + contraseña**. El identificador define el espacio de trabajo y evita que dos empresas compartan sesión por accidente.

## 6. Scripts

| Comando           | Qué hace                                   |
| ----------------- | ------------------------------------------ |
| `pnpm dev`        | API y frontend en paralelo                 |
| `pnpm dev:api`    | Solo API con recarga                       |
| `pnpm dev:web`    | Solo frontend                              |
| `pnpm build`      | Build de producción del frontend           |
| `pnpm start:api`  | API sin watch                              |
| `pnpm migrate`    | Aplica migraciones de MySQL                |
| `pnpm seed`       | Recrea los cuatro tenants demo y sus datos |
| `pnpm reset:demo` | Alias de `pnpm seed`                       |

`pnpm seed` es idempotente por tenant: actualiza los demos existentes en vez de duplicarlos.

## 7. Estructura del repositorio

```text
.
├── backend/
│   ├── scripts/seed.js            # Datos demo de las cuatro verticales
│   └── src/
│       ├── app.js                 # Composición de Fastify
│       ├── config.js              # Variables de entorno
│       ├── models/                # Tenant y User (Mongoose)
│       ├── db/                    # Conexión y migración de MySQL
│       ├── plugins/auth.js        # JWT, tenant, roles y verticales
│       ├── lib/verticals.js       # Catálogo de módulos por oficio
│       └── modules/               # Rutas por dominio
├── frontend/
│   ├── public/brand/              # Logos y marca SIVEP Tech
│   └── src/
│       ├── pages/                 # Portal, acceso, panel y módulos
│       ├── components/            # Shell, tablas, formularios, iconos
│       ├── lib/verticals.js       # Navegación y contenido por vertical
│       └── styles.css             # Sistema de diseño
├── image/                         # Arte de marca original
├── database.sql                   # Base y usuario de MySQL
└── package.json
```

## 8. API

Todas las respuestas usan `{ data: ... }` y los errores `{ error: { code, message } }`.

### Público

| Método | Ruta                        | Uso                                                  |
| ------ | --------------------------- | ---------------------------------------------------- |
| `GET`  | `/api/public/verticals`     | Catálogo de verticales                               |
| `GET`  | `/api/public/tenants/:slug` | Validar una empresa antes del login                  |
| `POST` | `/api/public/register`      | Registrar empresa + propietario                      |
| `POST` | `/api/public/ideas`         | Enviar una idea de sistema desde la página principal |

### Sesión

| Método  | Ruta                        | Uso                                    |
| ------- | --------------------------- | -------------------------------------- |
| `POST`  | `/api/auth/login`           | Login por empresa, correo y contraseña |
| `GET`   | `/api/auth/me`              | Usuario y empresa de la sesión         |
| `PATCH` | `/api/auth/profile`         | Actualizar nombre                      |
| `POST`  | `/api/auth/change-password` | Cambiar contraseña                     |

### Operación (requieren `Authorization: Bearer <token>`)

| Método                        | Ruta                        | Uso                                             |
| ----------------------------- | --------------------------- | ----------------------------------------------- |
| `GET` `PATCH`                 | `/api/tenant`               | Leer y editar ajustes de la empresa             |
| `GET` `POST` `PATCH` `DELETE` | `/api/users`                | Usuarios y roles                                |
| `GET` `POST` `PATCH` `DELETE` | `/api/customers`            | Clientes                                        |
| `GET` `POST` `PATCH` `DELETE` | `/api/products`             | Catálogo, stock y servicios                     |
| `GET` `POST` `DELETE`         | `/api/products/:id/batches` | Lotes por producto                              |
| `GET` `POST`                  | `/api/sales`                | Historial y venta transaccional                 |
| `GET`                         | `/api/sales/:id`            | Detalle de venta                                |
| `POST`                        | `/api/sales/returns`        | Devolución de producto (repone stock)           |
| `GET` `POST` `PATCH` `DELETE` | `/api/hotels/rooms`         | Habitaciones                                    |
| `GET` `POST` `PATCH` `DELETE` | `/api/hotels/reservations`  | Reservas                                        |
| `GET`                         | `/api/hotels/customers`     | Huéspedes con historial                         |
| `GET` `POST` `PATCH` `DELETE` | `/api/vet/pets`             | Pacientes                                       |
| `GET` `POST` `PATCH` `DELETE` | `/api/vet/appointments`     | Agenda                                          |
| `GET` `POST` `PATCH` `DELETE` | `/api/vet/grooming`         | Peluquería y servicios                          |
| `GET`                         | `/api/vet/customers`        | Tutores                                         |
| `GET` `PATCH`                 | `/api/vet/booking-settings` | Enlace público, servicios y horario de reservas |
| `GET`                         | `/api/pharmacy/batch-list`  | Lotes y vencimientos                            |
| `GET`                         | `/api/pharmacy/alerts`      | Próximos a vencer y stock bajo                  |
| `GET`                         | `/api/dashboard`            | Métricas del vertical y serie de 7 días         |

### Reservas públicas de veterinaria (sin sesión)

| Método | Ruta                                                     | Uso                                          |
| ------ | -------------------------------------------------------- | -------------------------------------------- |
| `GET`  | `/api/public/booking/:token`                             | Datos de la veterinaria, servicios y horario |
| `GET`  | `/api/public/booking/:token/availability?date=&service=` | Horarios libres para una fecha               |
| `POST` | `/api/public/booking/:token`                             | Crear la reserva desde el enlace público     |

Cada empresa veterinaria recibe un `token` único al activar sus reservas. El panel **Reservas** (`/app/reservas-vet`) muestra el enlace público `https://<host>/reservar/<token>`, permite pausarlo, editar servicios (nombre, duración y valor) y confirmar las solicitudes. La reserva crea o reutiliza el tutor por teléfono y la mascota por nombre, y aparece en la agenda con la marca **En línea**; los servicios de baño también se registran como sesión de peluquería. La disponibilidad cruza citas y sesiones existentes para evitar cruces de horario.

Una venta descuenta stock dentro de una transacción de MySQL y rechaza cantidades insuficientes. El precio y el total se calculan en el servidor.

La devolución (`POST /api/sales/returns` con `{ saleId, productId, quantity, reason }`, solo `owner`/`admin`) valida que el producto pertenezca a la venta, suma las devoluciones previas para no superar lo vendido y repone el stock únicamente en productos con `track_stock`. Responde `{ ok, saleId, productId, quantity, returnedTotal, remaining, newStock }`. El historial de ventas muestra el estado **Devuelta** o **Parcial**, y el detalle incluye las unidades devueltas por producto y el registro de cada devolución.

## 9. Multi-tenant, roles y verticales

1. El login exige el identificador de empresa y firma un JWT con `tenantId`, `tenantSlug` y `role`.
2. En cada petición autenticada, el backend carga la empresa desde el token. Si el cliente envía `x-tenant`, debe coincidir con la del token; si no, responde `403 TENANT_MISMATCH`. **La cabecera nunca cambia el tenant.**
3. Todas las consultas a MySQL filtran por `tenant_id`; las de Mongo por `tenantId`.
4. Los módulos de cada oficio se protegen con `requireVertical(...)`, así que una empresa de tienda no puede llamar endpoints de hoteles aunque conozca la ruta.
5. Los permisos de escritura se limitan con `requireRole(...)`.

| Rol     | Alcance                                                                                      |
| ------- | -------------------------------------------------------------------------------------------- |
| `owner` | Todo, incluida la identidad de la empresa y los usuarios. Único que puede crear otro `owner` |
| `admin` | Operación, ajustes de la empresa y usuarios (sin crear propietarios)                         |
| `staff` | Operación diaria: ventas, inventario, reservas y agenda; sin ajustes ni usuarios             |

La navegación del frontend se arma desde `frontend/src/lib/verticals.js`; el backend vuelve a validar cada acceso.

## 10. Variables de entorno

`backend/.env` (parte de `backend/.env.example`):

| Variable                        | Por defecto                            | Nota                                                                    |
| ------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `PORT`                          | `4000`                                 | Puerto de la API                                                        |
| `CORS_ORIGIN`                   | `http://localhost:5173`                | Admite varias separadas por coma                                        |
| `JWT_SECRET`                    | —                                      | **Obligatorio cambiarlo en producción**                                 |
| `JWT_EXPIRES_IN`                | `8h`                                   | Duración de la sesión                                                   |
| `MONGO_URI`                     | `mongodb://127.0.0.1:27017/sivep_tech` | Datos de empresa                                                        |
| `MYSQL_HOST` / `MYSQL_PORT`     | `127.0.0.1` / `3306`                   | Operación                                                               |
| `MYSQL_USER` / `MYSQL_PASSWORD` | `sivep` / `sivep`                      | Credenciales                                                            |
| `MYSQL_DATABASE`                | `sivep_tech`                           | Base operativa                                                          |
| `SMTP_USER` / `SMTP_PASS`       | — / —                                  | Cuenta Gmail y **contraseña de aplicación** para el formulario de ideas |
| `CONTACT_TO`                    | `siveptech@gmail.com`                  | Buzón que recibe las ideas del formulario                               |

`frontend/.env` es opcional: solo si el API vive en otro origen (`VITE_API_URL`).

### Formulario "Cuéntanos tu idea"

La sección `#ideas` de la página principal envía cada idea a `CONTACT_TO` (por defecto `siveptech@gmail.com`). Para activar el envío:

1. Entra a la cuenta de Gmail que recibirá los mensajes y activa la **verificación en dos pasos**.
2. En `Cuenta de Google → Seguridad → Contraseñas de aplicaciones`, crea una contraseña para "Correo".
3. Copia esa clave en `SMTP_PASS` dentro de `backend/.env` (y ajusta `SMTP_USER` si usas otra cuenta).
4. Reinicia la API.

Sin `SMTP_USER` y `SMTP_PASS`, la API responde `503 MAIL_NOT_CONFIGURED`; el formulario muestra entonces un enlace para escribir directo al correo, así ninguna idea se pierde.

## 11. Producción

- Define un `JWT_SECRET` largo y aleatorio; nunca uses el valor de ejemplo.
- Restringe `CORS_ORIGIN` a tu dominio real y sirve todo por HTTPS.
- Usa usuarios de MySQL con permisos mínimos y contraseñas propias.
- Ejecuta `pnpm migrate` como paso de despliegue y `pnpm build` para publicar el frontend.
- **No ejecutes `pnpm seed` en producción**: crea empresas y cuentas demo.
- Programa copias de Mongo y MySQL; son fuentes de verdad distintas.
- El rate limit ya protege login y registro; si hay proxy inverso, configura las IPs de confianza en Fastify.
- Las credenciales de `database.sql` y `backend/.env.example` son solo para desarrollo; usa usuarios y contraseñas propios en producción.

## 12. Marca

Los recursos originales están en `image/` y las versiones usadas por la interfaz en `frontend/public/brand/`.

- Vino: `#8B1E3F`
- Hoja: `#5B8C4E`
- Papel cálido: `#F6F3EE`
- Tipografías: Newsreader (títulos) e IBM Plex Sans (texto)

---

Hecho con cuidado, no con prisa.
