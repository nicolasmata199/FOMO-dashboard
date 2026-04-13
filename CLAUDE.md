# FOMO Dashboard — Contexto del proyecto

Panel financiero y operativo interno para tienda de celulares y accesorios en Argentina.

## Stack
- Next.js 14.1.0 (App Router, **JavaScript puro — sin TypeScript**)
- React 18
- Supabase (`@supabase/supabase-js` 2.39.0)
- Sin CSS frameworks — todo inline styles

## Deploy
- **Repo GitHub:** https://github.com/nicolasmata199/FOMO-dashboard
- **Producción:** https://fomo-dashboard2026.vercel.app
- **Deploy:** Vercel auto-deploy en push a main

## Variables de entorno (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` = https://vhguvqiqodkapscrdwpj.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = sb_publishable__-XWS38YXrXwl38RcJXiSQ_vWyqt9Vt
- `SUPABASE_SERVICE_KEY` = (JWT largo, ver Vercel)
- `CALLMEBOT_API_KEY` = 8154042
- `WHATSAPP_NUMERO` = 5493815195083

## Reglas importantes
- Siempre `.js`, nunca `.ts`
- `lib/supabase.js` usa funciones `getSupabase()` / `getSupabaseAdmin()` — nunca exports directos (evita error de build)
- Template literals con caracteres acentuados (á, é, ó) a veces fallan en SWC — usar concatenación de strings o unicode escapes (`\u00e1`)
- `app/api/alertas/route.js` necesita `export const dynamic = 'force-dynamic'`
- Los errores de "supabaseKey is required" en build local son normales — en Vercel funciona porque tiene las env vars
- Montos en WhatsApp usan prefijo `ARS ` (no `$`) para evitar interpolación PHP de CallMeBot
- Fechas de ventas se guardan en timezone Argentina (UTC-3): `new Date(new Date().getTime() - 3*60*60*1000).toISOString().split('T')[0]`

## Módulos y rutas

| Ruta | Archivo | Acceso |
|---|---|---|
| `/pos/login` | app/pos/login/page.js | Todos |
| `/pos` | app/pos/page.js | Todos (vendedoras y encargadas) |
| `/pos/ventas` | app/pos/ventas/page.js | Encargada, dueño |
| `/stock` | app/stock/page.js | Encargada, dueño |
| `/dashboard` | app/dashboard/page.js | Dueño |
| `/login` | app/login/page.js | Dueño (dashboard financiero) |

## Sucursales
```js
const SUCURSALES = ['695', '642', 'sanjuan', 'redes']
const SUCURSAL_LABEL = { '695':'Córdoba 695', '642':'Córdoba 642', 'sanjuan':'San Juan', 'redes':'Redes' }
```

## Roles
- `vendedora` — solo accede a /pos (registrar ventas)
- `encargada` — accede a /pos, /pos/ventas, /stock
- `dueno` — accede a todo

## Tablas Supabase

### Dashboard financiero (Nico)
- `datos_diarios` — efectivo, transferencias, tarjeta_pendiente, cheque_recibido, saldo_banco, ventas_acumuladas_mes, notas, fecha
- `vencimientos` — descripcion, monto, fecha, tipo, pagado, fecha_pago, usuario_nombre
- `deudas` — descripcion, monto, tipo, activa, usuario_nombre
- `gastos` — descripcion, monto, categoria, fecha, usuario_nombre
- `proveedores` — nombre, deuda_actual
- `historial` — tabla, accion, descripcion, usuario_nombre, created_at
- `profiles` — id, nombre, rol
- `cierre_caja` — vendedora_id, fecha, total_esperado, detalle_esperado (jsonb), detalle_real (jsonb), diferencia

### POS y stock
- `usuarios_fomo` — id, nombre, rol, sucursal (roles: vendedora, encargada, dueno)
- `ventas` — id, fecha (date, timezone AR), cliente_id, vendedora_id, vendedora_nombre, sucursal, total_ars, total_base_ars, intereses_ars, estado ('completada'|'anulada'), notas
- `detalle_venta` — venta_id, tipo_producto ('celular'|'accesorio'), imei, accesorio_id, descripcion, cantidad, precio_unitario_ars, costo_unitario_ars
- `pagos_venta` — venta_id, forma_pago, monto_base_ars, monto_ars, intereses_ars, monto_usd, canje_modelo, canje_imei, canje_valor
- `existencias` — imei, modelo, estado_equipo ('nuevo'|'usado_premium'), estado_stock ('disponible'|'vendido'), precio_venta_ars, sucursal, fecha_ingreso
- `accesorios` — nombre, categoria ('funda'|'templado'|'auricular'|'cargador'|'cable'|'otro'), costo_ars, precio_lista_ars, stock_actual, stock_minimo, sucursal, activo
- `clientes_pos` — nombre, telefono, email
- `control_faltantes` — fecha, sucursal, usuario_nombre, items (jsonb), notas
- `movimientos_stock` — tipo, descripcion, usuario_nombre, sucursal, created_at
- `objetivos` — sucursal, tipo, valor, mes

### Check constraints importantes
- `existencias_estado_equipo_check`: solo 'nuevo' y 'usado_premium' (NO 'usado')
- `accesorios_categoria_check`: solo 'funda', 'templado', 'auricular', 'cargador', 'cable', 'otro' (NO 'audio')

## API Routes

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/pos/venta` | POST | Crear venta (auth JWT requerida) |
| `/api/pos/venta/[id]` | PATCH | Editar venta (solo encargada/dueño) |
| `/api/pos/venta/[id]` | DELETE | Anular venta, restaura stock (solo encargada/dueño) |
| `/api/alertas` | GET | Cron WhatsApp 9am Argentina |

## Usuarios actuales

| Nombre | Rol | Sucursal |
|---|---|---|
| Nico | dueño | — |
| Camila Damato | encargada | 695 |
| Juan Cruz | encargada | 695 |
| Guada Burgos | encargada | sanjuan |
| Sofi | encargada | 642 |
| Turno Mañana 695 | vendedora | 695 |
| Turno Tarde 695 | vendedora | 695 |
| Turno Mañana 642 | vendedora | 642 |
| Turno Tarde 642 | vendedora | 642 |
| Turno Mañana SJ | vendedora | sanjuan |
| Turno Tarde SJ | vendedora | sanjuan |
| Redes 1 | vendedora | redes |
| Redes 2 | vendedora | redes |

## Flujo POS
1. Login → elegir nombre → elegir sucursal donde se trabaja hoy
2. Agregar productos al carrito (celulares por IMEI/modelo, accesorios por nombre)
3. Elegir formas de pago (efectivo, transferencia, tarjeta, QR, USD, plan canje, etc.)
4. Confirmar → se descuenta stock, se registra venta con sucursal elegida

## Flujo Stock (encargadas)
- Tab **Stock actual**: ver existencias por sucursal
- Tab **Ingreso**: cargar celulares (IMEI) o accesorios en lote (pegar desde Excel con Ctrl+V)
  - Si producto ya existe con costo diferente → pregunta si actualizar
- Tab **Ajustes**: corregir cantidades (queda registro en movimientos_stock)
- Tab **Faltantes**: registrar productos a reponer

## Lógica de negocio
- Stock puede quedar negativo (ventas permitidas aunque no haya stock)
- Plan canje: el celular entregado entra al stock como 'usado_premium' automáticamente
- Anular venta: restaura stock (celular → 'disponible', accesorios += cantidad), revierte plan canje
- Ventas anuladas no cuentan en rankings ni objetivos
- Objetivos: fundas_dia, templados_dia por sucursal; celulares_mes individual

## Después de cada cambio
```bash
npm run build   # verificar que no hay errores de compilación
git add [archivos]
git commit -m "descripción"
git push origin main
```
