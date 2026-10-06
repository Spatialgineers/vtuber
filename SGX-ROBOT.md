# SGX Robot · El personaje original

El estudio vuelve a abrir con **SGX Robot / SGX // 01**. En **Inputs → Character** puedes seleccionarlo directamente y alternar con los dos Highcoon.

Conserva el casco dorado, paneles metálicos, cara oscura, ojos y boca de energía cyan, antenas, halo y núcleo del diseño original. Tiene **57 huesos**, **75 piezas** y **9 morph targets**. Los 49 roles de cuerpo y dedos de la app se conectan automáticamente: pelvis, columna, pecho, hombros, brazos, manos, piernas, pies, dedos de los pies y las tres articulaciones de cada dedo de las manos. Los otros ocho controles son cuello, cabeza, dos ojos, dos cejas, mandíbula y boca de energía.

## Actuar

- La cámara local o facial remota controla cabeza, dirección de ojos, parpadeos, boca, sonrisa y cejas.
- El micrófono abre la boca de energía y mueve la mandíbula. **Act → Voice reactivity** ajusta boca, brillo y partículas.
- **Track my hands & arms** y el tracking de cuerpo completo mueven brazos, manos, dedos y piernas desde la cámara local. El controlador remoto mantiene sus pads de manos de puppet y poderes; su cámara sigue siendo facial.
- **Pose → Open 3D bone editor** permite seleccionar cualquiera de los 57 huesos y añadir rotaciones X/Y/Z. Estos ajustes se suman al tracking y se guardan en la escena. Puedes reiniciar un hueso o todos.
- **Map** conserva las nueve rutas de morphs y permite conectar señales a cualquier hueso o pieza. La mandíbula también reacciona a la apertura de boca; su intensidad está en el customizer.

## Personalizar

En **Layers → SGX Robot · Customizer**:

- Elige colores separados para armadura/casco, metal, cuerpo/cara, ojos, boca y núcleo/accesorios.
- Ajusta independientemente el brillo de ojos, boca y núcleo.
- En **Shape & surface**, cambia tamaño de cabeza, ancho/alto de ojos, ancho de boca, movimiento de mandíbula, metalness y rugosidad.
- Activa o quita casco, antenas, halo y símbolo del pecho. La lista de layers mantiene su estado y permite ocultar cualquier pieza individual.
- **Restore original look** recupera el look SGX conservando tus ajustes de huesos. El botón de restauración junto a Character también borra esas poses y recupera el robot original.

**Save** guarda personaje, colores, proporciones, poses, layers, mapping, cámara y escenario. **Export settings** / **Import settings** conserva esos parámetros; las escenas antiguas reciben los valores originales del robot cuando no contienen sus nuevos ajustes.

## GLB y huesos reales

**Download robot GLB**, en el customizer, descarga la apariencia y pose actuales. Para un archivo neutral, libera las poses, apaga la cámara y el demo, y espera a que el personaje vuelva a reposo antes de descargarlo.

El archivo conserva los 57 joints reales, pesos rígidos para las 75 piezas mecánicas, materiales y morph targets. Al reimportarlo, la app reconoce el robot y permite seguir personalizándolo. Las proporciones y poses exportadas pasan a formar parte de su base; los controles de proporción y pose empiezan desde esa base para evitar aplicarlos dos veces.

## Verificación

`node scripts/verify-robot.mjs` comprueba los 57 huesos y 49 conexiones, los colores independientes, personalización, migración de escenas, posiciones de vértices al exportar/reimportar, ausencia de escala doble, morphs y deformación real al mover un dedo del GLB.

`verify-engine.mjs` comprueba geometría, morphs y recursos. `verify-rig.mjs` comprueba cuerpo completo, mirroring, dedos, pausa, confianza, pies y compensación cabeza/torso. La GPU, cámara física y captura final deben verificarse en el dispositivo donde se hará el stream.

The expanded [pose and action deck workflow](POSE-AND-ACTION-DECK.md) adds viewport joint selection and transform gizmos, hand/foot IK, saved poses, keyframe clips and three configurable banks synced to the phone. Robot Wave, Hero landing and Groove are editable starter clips. Export custom timeline clips as a JSON library; they are not baked into the character GLB.

Para devolver brazos y dedos de una pose o clip al tracking, pulsa **Live** o **Track my hands & arms**. Esto conserva la apariencia y la biblioteca, libera el editor y recalcula las referencias del rig cuando cambias proporciones.
