# Crear poses, movimientos y pads

El menú principal tiene cuatro entradas: **Actuar**, **Personaje**, **Crear** y **Escena**. En Crear hay tres recorridos. Una pose es una postura fija; una animación es un movimiento reutilizable. El botón superior **Grabar video** descarga video de tu actuación.

## Guardar una pose

1. Abre **Crear → Guardar una pose**.
2. Elige **Cabeza**, **Torso**, una mano o un pie. Arrastra las flechas para mover, los aros para girar o usa Estirar. Puedes seleccionar también los marcadores del personaje. Para copiar tu postura, prende la cámara y usa **Copiar mi postura**: tendrás tres segundos para colocarte.
3. Ponle un nombre y pulsa **Guardar pose**. La app guarda la acción y el personaje actual en tu cuenta. Para modificarla después, usa **Editar** en Tu biblioteca y **Guardar cambios de pose**.
4. Usa **Probar** o **Poner en un pad**. Se elige un espacio libre sin reemplazar otra acción. El mensaje indica el banco y número. Toca ese pad debajo del personaje o en tu teléfono conectado.

No hace falta guardar la escena después. Si falla el guardado, el borrador permanece disponible con **Reintentar guardado**. **Volver a actuar en vivo** devuelve el cuerpo y los dedos a la cámara.

## Grabar mis movimientos

1. Abre **Crear → Grabar mis movimientos** y ponle nombre.
2. Prende la cámara de esta pantalla o del teléfono, o usa los pads. La captura activa manos y brazos; si tenías cuerpo completo, conserva ese modo. Mantén hombros, codos y muñecas visibles.
3. Elige un máximo de 5, 10 o 20 segundos y pulsa **Empezar captura**. Tras la cuenta de tres segundos, actúa. Puedes cambiar de panel durante la captura.
4. Pulsa **Detener y guardar movimiento**, o deja que llegue al límite. Después puedes probarlo, asignarlo a un pad o editar sus posiciones.

Se capturan los huesos y las expresiones del personaje, no video de la cámara. Las muestras se toman a seis por segundo, hasta 120. Las capturas densas reducen muestras si hace falta para caber en la biblioteca, conservando la duración y ambos extremos. Si no hay espacio ni para una captura pequeña, puedes liberar espacio y reintentar, o descargarla como JSON.

## Animar paso a paso

1. Abre **Crear → Animar paso a paso**, ponle nombre y pulsa **Crear animación con esta postura**. Esa es la Posición 1.
2. Mueve el personaje. Elige cuánto tarda en llegar a la siguiente postura y pulsa **Añadir posición al final**. Repite para construir el movimiento.
3. Para cambiar una postura anterior, selecciona su botón, ajusta el personaje y pulsa **Actualizar posición seleccionada**.
4. Usa **Probar animación**, **Guardar animación** y **Poner en un pad**.

**Abrir timeline avanzado** muestra debajo del personaje los tiempos exactos: arrastrar rombos, pasos de frame, Auto key, copiar/pegar/espejar, duplicar clips, deshacer/rehacer, retiming, interpolación y velocidad. El editor de huesos ofrece los ejes locales o de escena, snapping, visibilidad de huesos, campos numéricos y resets dentro de **Todos los huesos y ajustes precisos**. Mover manos y pies usa IK cuando el rig tiene una cadena compatible. Estirar una parte permite squash/stretch.

En móvil el personaje permanece visible encima de los controles de creación. Al abrir el timeline avanzado, la vista pasa al personaje y timeline completos.

## Cara en vivo y compatibilidad

**Opciones de reproducción → Mantener cara y boca en vivo** deja expresiones, cabeza y morphs bajo tracking durante una pose o animación. Desactívalo para reproducir la cara guardada. El editor puede colocar todas las partes. Los clips interpolan rotaciones con quaternion SLERP y ofrecen Smooth, Linear y Hold/Step en el timeline. Un movimiento sin loop mantiene el último frame; algunos presets incluyen un final neutral.

Las poses se identifican por la jerarquía y los transforms de referencia del rig. La biblioteca muestra las acciones compatibles con el personaje abierto. Las variantes de Robot comparten rig y conservan sus proporciones. No hay retargeting automático entre esqueletos distintos.

## Configurar pads

La asignación rápida desde Tu biblioteca usa Tap. **Crear → Configurar pads** permite elegir banco y espacio, nombre y acción. **Color y modo de pulsación** y **Añadir powers, gestos y cámara** ofrecen las combinaciones avanzadas. **Guardar pad** conserva el resultado directamente en la cuenta.

- **Tap** aplica o reinicia la acción.
- **Hold** aplica mientras presionas y restaura al soltar, cancelar, cambiar de banco o perder foco. Un watchdog restaura a los ocho segundos si se pierde el release.
- **Toggle** activa con el primer toque y restaura con el segundo.

Los tres bancos tienen doce espacios. Los números 1–9 / 0 controlan los primeros diez; todos responden al toque. Moods conserva 1–6. Space pausa y Escape vuelve del modo limpio. Los atajos ignoran formularios y diálogos.

El teléfono muestra los mismos pads y envía sus IDs. El host resuelve la acción y compatibilidad. El enlace directo envía controles antes de las solicitudes a la nube, y soltar no espera el reconocimiento del press. La vista previa viaja por un canal separado.

## Biblioteca y salida

**Importar, exportar y gestionar biblioteca** ofrece el JSON portátil, merge por ID y slot, gestión de acciones y starter pack del Robot. Los cuatro presets de postura y Wave, Hero landing y Groove aparecen en el primer arranque; sus pads suelen estar en Banco B. Los Highcoons mantienen sus clips de Riftlands.

Límites: 48 poses, 24 clips, 120 posiciones por clip, 180 huesos y 200 morphs por frame, cinco minutos por clip y 900 KB por biblioteca. **Guardar escena** conserva además el entorno, cámara y configuración general. **Grabar video**, PNG y Clean window capturan la salida limpia sin marcadores ni gizmos. Las animaciones creadas viajan en JSON, no se hornean como clips internos al exportar GLB.

## Verificación

`node scripts/verify-authoring.mjs` recorre guardar/reproducir poses de un Robot customizado, interpolar brazos y dedos, asignar y disparar un pad real, conservar dimensiones, limitar capturas densas y renderizar los nuevos controles. `verify-performance.mjs` comprueba rigs Robot y Highcoon, skinning, TransformControls, picking, IK, prioridades, playback y ownership de pads. `verify-characters.mjs` comprueba persistencia, variantes y GLB. Tras el build, `verify-remote-worker.mjs` comprueba guardar y recuperar pose → posiciones → pad directamente en la biblioteca de cuenta, además de APIs, aislamiento y límites.

Estas comprobaciones usan CPU, runtime y adapters de transporte. La cámara física, WebGL, drag en dispositivos reales y salida Restream requieren comprobación en el equipo del usuario.
