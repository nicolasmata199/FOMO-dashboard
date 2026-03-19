# CLAUDE_CONTEXT.md — Reglas técnicas del proyecto FOMO Dashboard

## REGLA #1 — ANTES DE CUALQUIER CAMBIO
Siempre ejecutá estos comandos y mostrá el output RAW completo sin resumir ni interpretar:
```
bash -c "sed -n 'LINEA_INICIO,LINEA_FINp' app/dashboard/page.js"
```
Si Claude Code resume el output en lugar de mostrarlo, respondé: "Mostrá el output RAW del bash sin resumir"

---

## REGLA #2 — OPERACIONES DE BASE DE DATOS (CRÍTICO)

### NUNCA usar upsert para actualizar campos individuales
❌ MAL:
```js
await supabase.from('datos_diarios').upsert({ campo: valor })
```
✅ BIEN — siempre buscar el registro primero, luego actualizar:
```js
const { data: row } = await supabase.from('datos_diarios')
  .select('*')           // SIEMPRE select('*'), nunca select parcial
  .eq('fecha', fecha)
  .eq('usuario_id', userId)
  .single()

if (row) {
  await supabase.from('datos_diarios')
    .update({ campo: (row.campo || 0) + nuevoValor })  // SUMAR, no reemplazar
    .eq('id', row.id)
} else {
  // Solo crear si realmente no existe, con todos los campos necesarios
}
```

### NUNCA reemplazar — siempre sumar/acumular
- efectivo: siempre `(row.efectivo || 0) + monto`
- transferencias: siempre `(row.transferencias || 0) + monto`
- saldo_banco: siempre `(row.saldo_banco || 0) + monto`
- tarjeta_pendiente: siempre `(row.tarjeta_pendiente || 0) + monto`

### select siempre con ('*') cuando vas a hacer update después
Nunca `.select('id,efectivo')` si después necesitás otros campos.

---

## REGLA #3 — FLUJO DE CAJA

### Lógica de entradas diarias (proyección 30 días)
```js
const ventasReal = Number(ventasMap[fechaStr] || 0)
entradas = ventasReal > 0 ? ventasReal : FLUJO_DEFAULT
// Si hay venta real → usar SOLO venta real
// Si NO hay venta real → usar SOLO estimado
// NUNCA sumar los dos
```

### Caja de arranque
- Es el total acumulado real: efectivo + transferencias + saldo_banco - gastos
- NUNCA modificar este valor directamente
- Se recalcula solo con loadAll()

---

## REGLA #4 — TARJETA PENDIENTE

### Lógica correcta
- `tarjeta_pendiente` en datos_diarios = monto que el banco aún no acreditó ese día
- `tarjetaAcumulada` = suma de todos los días con `tarjeta_acreditada=false` AND `tarjeta_pendiente > 0`
- Al acreditar: marcar `tarjeta_acreditada=true` en el día original, sumar al `saldo_banco` de HOY
- Si el día original ES hoy: hacer UN SOLO update, no dos

### Query para calcular acumulado
```js
supabase.from('datos_diarios')
  .select('tarjeta_pendiente,tarjeta_acreditada')
  .eq('tarjeta_acreditada', false)
  .gt('tarjeta_pendiente', 0)
```

---

## REGLA #5 — AFTER EVERY CHANGE

Siempre llamar `await loadAll()` al final de cualquier función que modifique datos.
NUNCA depender del estado local para reflejar cambios — siempre recargar desde Supabase.

---

## REGLA #6 — COMMITS

- Un solo commit por tarea
- Formato: `git add app/dashboard/page.js && git commit -m "descripcion" && git push`
- Nunca hacer push parcial

---

## REGLA #7 — ESTRUCTURA DEL ARCHIVO

| Líneas | Contenido |
|--------|-----------|
| 1-80 | Imports, helpers, funciones auxiliares |
| 81-130 | Estados (useState) |
| 131-230 | loadAll() / loadData() — queries Supabase |
| 231-480 | Funciones de acción (guardar, pagar, acreditar, ajustar) |
| 480-620 | useMemo (flujo, cálculos derivados) |
| 618-640 | Estilos (const S, const C) |
| 640-800 | Tab HOY — render |
| 800-1100 | Tab CARGAR — render |
| 1100-1400 | Tab PAGOS — render |
| 1400-1700 | Tab P&L — render |
| 1700-1818 | Tab FLUJO + modales — render |

---

## REGLA #8 — TABLA datos_diarios (campos)

```
id, fecha, usuario_id, usuario_nombre,
efectivo, transferencias, cheque_recibido, saldo_banco,
tarjeta_pendiente, tarjeta_acreditada, tarjeta_monto_real,
ventas_acumuladas_mes, ventas_695, ventas_642, ventas_sanjuan,
notas, tarjeta_acreditada
```

---

## REGLA #9 — ERRORES FRECUENTES A EVITAR

| Error | Causa | Fix |
|-------|-------|-----|
| Campo se reemplaza en lugar de sumar | upsert o select parcial | select('*') + update con suma |
| Saldo banco se duplica | Update en día original + update en hoy cuando son el mismo | Verificar si fechaOriginal === hoy |
| tarjetaAcumulada no baja | Query no filtra gt('tarjeta_pendiente',0) | Agregar .gt('tarjeta_pendiente',0) |
| Último dato no aparece | setFechaDatosHoy se pisa | Setear desde rowsRecientes[0].fecha |
| Flujo suma doble | ventasMap || FLUJO_DEFAULT cuando hay venta real | Usar ternario ventasReal > 0 |
| Claude Code resume output | Comportamiento por defecto | Agregar "Mostrá output RAW sin resumir" en el prompt |

---

## REGLA #10 — PROMPT TEMPLATE para Claude Code

Siempre usar esta estructura:
```
1. Mostrá el output RAW sin resumir de:
   bash -c "sed -n 'X,Yp' app/dashboard/page.js"

2. [Descripción exacta del cambio con las líneas a modificar]

3. Verificá que:
   - No se reemplace ningún campo, solo se sume/actualice el campo específico
   - Se use select('*') antes de cualquier update
   - Se llame loadAll() al final

4. Un solo commit:
   git add app/dashboard/page.js && git commit -m "descripcion" && git push
```
