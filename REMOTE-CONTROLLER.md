# Cámara remota y pads · SGX vTuber Engine

## Para usar con Restream

1. Abre el estudio en la computadora. En **Inputs**, pulsa **Conectar teléfono · QR**.
2. Escanea el QR con otro dispositivo. También puedes abrir `/controller` y escribir el código de ocho caracteres. Usa la misma cuenta de ChatGPT en ambos dispositivos.
3. Elige **Manos y brazos** o **Cuerpo completo**; usa **Cara · rápido** para priorizar velocidad. Pulsa **Activar cámara frontal** en el controlador y acepta el permiso de cámara. Calibra la cara mirando al frente cuando aparezca detectada.
4. En la computadora, abre **Clean window** y comparte esa ventana en Restream. Mantén el estudio abierto y el controlador visible.

La cámara del teléfono procesa cara, cabeza, ojos, expresiones y, según el modo, manos, dedos, brazos y cuerpo completo. Su video permanece en el teléfono. El micrófono del estudio y la cámara que uses en Restream se controlan por separado. Puedes usar los pads con la cámara del teléfono apagada.

## Performance

- Los seis modos cambian la intensidad y apariencia del personaje.
- Animaciones ofrece accesos rápidos y la lista de clips del modelo actual, con reproducción única o en bucle. Los Highcoon conservan sus 31 clips de Riftlands.
- Los ocho poderes incluyen sus efectos y clips compatibles, Spectrum, Overload y apagado de efectos.
- Las manos de puppet permiten abrir, cerrar, señalar y extender los dedos. Puedes elegir mano izquierda, derecha o ambas; las posiciones se refieren al personaje.
- Los controles de escena calibran la cara, pausan el personaje, cambian el encuadre y vuelven a neutral.

Los pads confirman cuando el estudio aplica la acción. El controlador muestra el personaje, clips y estado disponibles en el estudio. Al activar la cámara o elegir un modo de tracking se liberan poses y puppet para seguir tu actuación. Los pads pueden tomar el cuerpo temporalmente; pulsa **Live** o vuelve a elegir el modo de tracking para liberarlo. Mantén hombros, codos y muñecas visibles para los brazos, y también caderas, rodillas y pies para cuerpo completo. El tracking local conserva las mismas opciones al cerrar la conexión remota. El estudio incluye editor de huesos, poses y timeline; asigna sus clips a los pads para ejecutarlos desde el teléfono.

## Preview del personaje y latencia

El monitor pequeño y fijo muestra la salida limpia del estudio, nunca la cámara ni los gizmos. El objetivo es 8 fps en enlace directo y 2 fps en nube, a 320×180, con nombre de personaje, clip y playhead. Puedes ocultarlo y ampliar o compactar la vista de cámara. Si deja de llegar imagen, muestra FRAME ANTIGUO en vez de presentarla como live.

Un pad por conexión directa se envía inmediatamente, sin esperar el POST de nube. La confirmación de una acción ya no bloquea el próximo toque ni soltar Hold. Las acciones tienen orden, ID y época de sesión; el fallback no duplica ni adelanta acciones. Hay confirmaciones para ráfagas y un timeout que pide reconectar si falta una acción. El preview usa otro canal, descarta imágenes bajo congestión y limita su tamaño.

Directa/Nube muestra el tiempo medido de ida y confirmación. Compartir Wi-Fi facilita una conexión directa. El transporte de nube sigue dependiendo del tiempo de red y de las peticiones del estudio; no se promete latencia cero.

## Conexión y recuperación

La app intenta un enlace WebRTC directo entre dispositivos. Además de candidatos locales, usa STUN público de Cloudflare para descubrir rutas entre redes. TURN no está configurado. Si el enlace directo no se establece o se pierde, pasa al transporte por la nube. El transporte por la nube tiene menos frecuencia y puede añadir latencia. Una red local compartida suele facilitar el enlace directo, pero su disponibilidad depende del navegador y de la red.

Solo hay un controlador activo por sesión. Recargar la misma pestaña conserva su identidad de dispositivo y recibe una nueva sesión de tracking para evitar que los números de secuencia anteriores bloqueen las expresiones nuevas. Para cambiar de dispositivo, desconecta el anterior o espera a que venza su conexión activa de 15 segundos. La sesión completa dura seis horas. **Desconectar** en el estudio revoca el enlace y permite volver a usar la cámara local.

Si el navegador incrustado bloquea los permisos, abre el controlador en una pestaña independiente. No cambies de aplicación mientras haces tracking: los navegadores móviles pueden suspender cámara, procesamiento o conexiones en segundo plano. La app solicita mantener la pantalla despierta cuando el navegador lo permite.

## Datos y desarrollo

Las rutas requieren la identidad autenticada del propietario, un origen permitido y, para el controlador, el código o secreto de emparejamiento. El secreto del QR viaja en el fragmento de URL y se guarda como hash en el servidor. No se transfieren video ni audio del teléfono.

El transporte de expresiones envía coeficientes permitidos y una matriz de cabeza, sin imágenes de cámara. Los modos de manos y cuerpo añaden coordenadas compactas de joints, sus scores y la edad de la última detección; el reloj del teléfono no se usa como reloj del estudio. La nube conserva solo el paquete más reciente; el estudio rechaza paquetes antiguos o fuera de orden y usa su propio reloj al recibirlos. Los pads tienen identificadores únicos y confirmaciones para evitar repeticiones entre ambos transportes. Al crear sesiones se eliminan registros vencidos; revocar una sesión elimina inmediatamente sus filas y comandos.

La migración `drizzle/0001_fluffy_dorian_gray.sql` añade las tablas de conexión y comandos. Se aplica mediante el flujo de migraciones de D1, nunca desde una petición de usuario.

## Validación

`node scripts/verify-remote.mjs` prueba el almacén real de D1 y ambos clientes: aislamiento, permisos, renovación al recargar, expresiones, joints de cuerpo y dedos en ambos transportes, detecciones sin cara visible, relojes, comandos duplicados, recuperación de red, negociación con adaptadores WebRTC y transición a la nube. Los adaptadores no prueban ICE real.

`node scripts/verify-remote-worker.mjs` prueba el Worker compilado: rutas, autenticación, origen, entradas inválidas, entrega y confirmación de pads, revocación y carga inicial del estudio/controlador. Requiere compilar primero.

`node scripts/verify-hands.mjs` verifica los huesos y la deformación de dedos en ambos GLB Highcoon, manos de puppet y mezcla con tracking local. Las verificaciones de cámara y rig siguen en `verify-camera.mjs` y `verify-rig.mjs`.

Estas pruebas no sustituyen una prueba física con teléfono, cámara, GPU, red y captura en Restream. Ese recorrido y su latencia deben comprobarse en los dispositivos del usuario.

The phone now mirrors three configurable action banks from the studio. Pose and keyframe clips can be assigned in desktop Pads, combined with moods, powers, hand gestures and framing, then fired by Tap/Hold/Toggle. Hold release sends immediately after press, without waiting for acknowledgement; ordered envelopes preserve their sequence. The host restores a lost Hold after eight seconds. [Full editor and deck guide](POSE-AND-ACTION-DECK.md).
