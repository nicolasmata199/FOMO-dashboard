# FOMO Dashboard - Instrucciones de deploy

## Paso 1 - Configurar variables de entorno en Vercel

Cuando subas el proyecto a Vercel, configurá estas variables:

NEXT_PUBLIC_SUPABASE_URL = https://vhguvqiqodkapscrdwpj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = (tu anon key)
SUPABASE_SERVICE_KEY = (tu service role key)
CALLMEBOT_API_KEY = (tu clave de CallMeBot)
WHATSAPP_NUMERO = 549XXXXXXXXXX (tu número sin +)

## Paso 2 - Crear usuarios en Supabase

1. Ir a Supabase > Authentication > Users
2. Click "Add user" > "Create new user"
3. Crear:
   - nicolas@fomo.com / (contraseña segura) -> rol: owner
   - sofia@fomo.com / (contraseña) -> rol: admin
   - juancruz@fomo.com / (contraseña) -> rol: admin

4. Ir a SQL Editor y ejecutar para cada usuario:
INSERT INTO public.profiles (id, nombre, rol)
VALUES ('UUID-DEL-USUARIO', 'Nicolas', 'owner');

## Paso 3 - Alertas WhatsApp

1. Ir a callmebot.com/whatsapp.html
2. Agregar el contacto +34 644 44 82 38 a WhatsApp
3. Enviar: "I allow callmebot to send me messages"
4. Guardar el apikey que te mandan
5. Ponerlo en CALLMEBOT_API_KEY en Vercel

## Paso 4 - Configurar alertas automáticas diarias

En Vercel > proyecto > Settings > Cron Jobs:
- Path: /api/alertas
- Schedule: 0 9 * * * (todos los días a las 9am)
