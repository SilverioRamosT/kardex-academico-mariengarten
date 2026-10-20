// =====================================================================
// KÁRDEX ACADÉMICO DIGITAL — U.E. Marien Garten A
// Panel Docente: login, registro de calificaciones y observaciones
// =====================================================================

// --- Configuración de Supabase --------------------------------------
const SUPABASE_URL = 'https://aspjkfgocyeitvvnumiq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzcGprZmdvY3llaXR2dm51bWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njg0MzgsImV4cCI6MjEwNjE0NDQzOH0.Mw6tsbeNgYMIYYlPh34gx9m3N3BiT6Ncs094fseYxOM'';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Estado en memoria -------------------------------------------------
let docenteActual = null;       // fila de public.docentes
let asignaciones = [];          // [{ curso_id, materia_id, cursos:{...}, materias:{...} }]
let estudiantesCurso = [];      // estudiantes del curso seleccionado
let calificacionesPorEstudiante = {}; // { estudiante_id: {nota_ser, nota_saber, nota_hacer, nota_decidir} }

// --- Referencias DOM: login ---------------------------------------------
const seccionLogin = document.getElementById('seccion-login');
const formLogin = document.getElementById('form-login');
const btnLogin = document.getElementById('btn-login');
const btnLoginLabel = document.getElementById('btn-login-label');
const loginError = document.getElementById('login-error');
const loginErrorTexto = document.getElementById('login-error-texto');

// --- Referencias DOM: panel ----------------------------------------------
const panelDocente = document.getElementById('panel-docente');
const bloqueDocenteHeader = document.getElementById('bloque-docente-header');
const nombreDocenteHeader = document.getElementById('nombre-docente-header');
const btnLogout = document.getElementById('btn-logout');

const selectCurso = document.getElementById('select-curso');
const selectMateria = document.getElementById('select-materia');
const selectTrimestre = document.getElementById('select-trimestre');

const panelAviso = document.getElementById('panel-aviso');

const tabBtnCalificaciones = document.getElementById('tab-btn-calificaciones');
const tabBtnObservaciones = document.getElementById('tab-btn-observaciones');
const tabCalificaciones = document.getElementById('tab-calificaciones');
const tabObservaciones = document.getElementById('tab-observaciones');

const sinSeleccionCalif = document.getElementById('sin-seleccion-calif');
const contenedorTablaCalif = document.getElementById('contenedor-tabla-calif');
const tablaCalificacionesDocente = document.getElementById('tabla-calificaciones-docente');
const btnGuardarNotas = document.getElementById('btn-guardar-notas');
const btnGuardarNotasLabel = document.getElementById('btn-guardar-notas-label');

const sinSeleccionObs = document.getElementById('sin-seleccion-obs');
const formObservacion = document.getElementById('form-observacion');
const obsEstudiante = document.getElementById('obs-estudiante');
const obsTipo = document.getElementById('obs-tipo');
const obsDescripcion = document.getElementById('obs-descripcion');
const btnRegistrarObs = document.getElementById('btn-registrar-obs');
const btnRegistrarObsLabel = document.getElementById('btn-registrar-obs-label');

// =====================================================================
// INICIO / SESIÓN
// =====================================================================

// Al cargar la página, revisa si ya hay una sesión activa
init();

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await cargarPanelDocente();
  }
}

formLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarLoginError();
  setCargandoLogin(true);

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  setCargandoLogin(false);

  if (error || !data.session) {
    mostrarLoginError('Correo o contraseña incorrectos. Verifique sus credenciales.');
    return;
  }

  await cargarPanelDocente();
});

btnLogout.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  docenteActual = null;
  asignaciones = [];
  estudiantesCurso = [];
  calificacionesPorEstudiante = {};
  panelDocente.classList.add('hidden');
  bloqueDocenteHeader.classList.add('hidden');
  seccionLogin.classList.remove('hidden');
  formLogin.reset();
});

// --- Cargar datos del docente y sus asignaciones ------------------------
async function cargarPanelDocente() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data: docente, error: errDocente } = await supabaseClient
    .from('docentes')
    .select('id, nombres, apellidos, es_tecnico')
    .eq('user_id', user.id)
    .single();

  if (errDocente || !docente) {
    mostrarLoginError('Su usuario no tiene un perfil de docente registrado. Contacte a dirección.');
    await supabaseClient.auth.signOut();
    return;
  }

  docenteActual = docente;

  const { data: asigs, error: errAsigs } = await supabaseClient
    .from('asignaciones_docente')
    .select(`
      curso_id,
      materia_id,
      cursos ( id, grado, paralelo, nivel ),
      materias ( id, nombre, es_tecnica )
    `)
    .eq('docente_id', docente.id);

  if (errAsigs) {
    mostrarLoginError('No se pudieron cargar sus asignaciones. Intente nuevamente.');
    return;
  }

  asignaciones = asigs || [];

  // UI: mostrar panel, ocultar login
  seccionLogin.classList.add('hidden');
  panelDocente.classList.remove('hidden');
  bloqueDocenteHeader.classList.remove('hidden');
  bloqueDocenteHeader.classList.add('flex');
  nombreDocenteHeader.textContent = `${docente.nombres} ${docente.apellidos}`;

  poblarSelectCursos();
}

// =====================================================================
// SELECTORES DE CONTEXTO (curso / materia / trimestre)
// =====================================================================

function poblarSelectCursos() {
  // Cursos únicos entre las asignaciones del docente
  const cursosUnicos = new Map();
  for (const a of asignaciones) {
    if (a.cursos) cursosUnicos.set(a.cursos.id, a.cursos);
  }

  selectCurso.innerHTML = '<option value="">Seleccione un curso</option>';
  for (const curso of cursosUnicos.values()) {
    const opt = document.createElement('option');
    opt.value = curso.id;
    opt.textContent = `${curso.grado}° "${curso.paralelo}" — ${curso.nivel}`;
    selectCurso.appendChild(opt);
  }
}

selectCurso.addEventListener('change', () => {
  poblarSelectMaterias(selectCurso.value);
  limpiarSeleccionEstudiantes();
});

function poblarSelectMaterias(cursoId) {
  selectMateria.innerHTML = '<option value="">Seleccione una materia</option>';

  if (!cursoId) {
    selectMateria.disabled = true;
    selectMateria.innerHTML = '<option value="">Seleccione un curso primero</option>';
    return;
  }

  // Materias que este docente dicta específicamente en el curso elegido
  // (cubre materias regulares y materias técnicas repetidas en varios cursos,
  // como Computación, porque cada curso tiene su propia fila en asignaciones_docente)
  const materiasDelCurso = asignaciones
    .filter((a) => a.curso_id === cursoId && a.materias)
    .map((a) => a.materias);

  for (const materia of materiasDelCurso) {
    const opt = document.createElement('option');
    opt.value = materia.id;
    opt.textContent = materia.nombre + (materia.es_tecnica ? ' (Técnica)' : '');
    selectMateria.appendChild(opt);
  }

  selectMateria.disabled = materiasDelCurso.length === 0;
}

selectMateria.addEventListener('change', cargarEstudiantesYContexto);
selectTrimestre.addEventListener('change', cargarEstudiantesYContexto);

function limpiarSeleccionEstudiantes() {
  estudiantesCurso = [];
  calificacionesPorEstudiante = {};
  contenedorTablaCalif.classList.add('hidden');
  sinSeleccionCalif.classList.remove('hidden');
  formObservacion.classList.add('hidden');
  sinSeleccionObs.classList.remove('hidden');
}

// =====================================================================
// TAB: CALIFICACIONES
// =====================================================================

async function cargarEstudiantesYContexto() {
  const cursoId = selectCurso.value;
  const materiaId = selectMateria.value;
  const trimestre = Number(selectTrimestre.value);

  if (!cursoId || !materiaId) {
    limpiarSeleccionEstudiantes();
    return;
  }

  ocultarAvisoPanel();

  const { data: estudiantes, error: errEst } = await supabaseClient
    .from('estudiantes')
    .select('id, numero_kardex, nombres, apellidos')
    .eq('curso_id', cursoId)
    .order('apellidos', { ascending: true });

  if (errEst) {
    mostrarAvisoPanel('No se pudo cargar la lista de estudiantes.', 'error');
    return;
  }

  estudiantesCurso = estudiantes || [];

  const { data: calificaciones, error: errCalif } = await supabaseClient
    .from('calificaciones')
    .select('estudiante_id, nota_ser, nota_saber, nota_hacer, nota_decidir')
    .eq('materia_id', materiaId)
    .eq('trimestre', trimestre)
    .in('estudiante_id', estudiantesCurso.map((e) => e.id));

  if (errCalif) {
    mostrarAvisoPanel('No se pudieron cargar las calificaciones existentes.', 'error');
    return;
  }

  calificacionesPorEstudiante = {};
  for (const c of calificaciones || []) {
    calificacionesPorEstudiante[c.estudiante_id] = c;
  }

  renderTablaCalificaciones();
  poblarSelectEstudianteObservacion();
}

function renderTablaCalificaciones() {
  tablaCalificacionesDocente.innerHTML = '';

  if (estudiantesCurso.length === 0) {
    sinSeleccionCalif.textContent = 'Este curso no tiene estudiantes registrados.';
    sinSeleccionCalif.classList.remove('hidden');
    contenedorTablaCalif.classList.add('hidden');
    return;
  }

  sinSeleccionCalif.classList.add('hidden');
  contenedorTablaCalif.classList.remove('hidden');

  for (const est of estudiantesCurso) {
    const previa = calificacionesPorEstudiante[est.id] || {};
    const fila = document.createElement('tr');
    fila.dataset.estudianteId = est.id;
    fila.innerHTML = `
      <td class="py-2.5 pr-3">
        <div class="font-medium">${escapeHtml(est.apellidos)} ${escapeHtml(est.nombres)}</div>
        <div class="text-xs text-[#1F2937]/45">${escapeHtml(est.numero_kardex)}</div>
      </td>
      <td class="py-2 px-2">
        <input type="number" min="0" max="10" step="0.1" data-campo="nota_ser"
          value="${previa.nota_ser ?? ''}"
          class="w-full border border-institucional-900/20 px-2 py-1.5 text-sm text-center focus:border-institucional-900" />
      </td>
      <td class="py-2 px-2">
        <input type="number" min="0" max="45" step="0.1" data-campo="nota_saber"
          value="${previa.nota_saber ?? ''}"
          class="w-full border border-institucional-900/20 px-2 py-1.5 text-sm text-center focus:border-institucional-900" />
      </td>
      <td class="py-2 px-2">
        <input type="number" min="0" max="40" step="0.1" data-campo="nota_hacer"
          value="${previa.nota_hacer ?? ''}"
          class="w-full border border-institucional-900/20 px-2 py-1.5 text-sm text-center focus:border-institucional-900" />
      </td>
      <td class="py-2 px-2">
        <input type="number" min="0" max="5" step="0.1" data-campo="nota_decidir"
          value="${previa.nota_decidir ?? ''}"
          class="w-full border border-institucional-900/20 px-2 py-1.5 text-sm text-center focus:border-institucional-900" />
      </td>
      <td class="py-2.5 pl-2 text-right font-semibold text-institucional-900" data-campo="nota_final">
        ${calcularNotaFinal(previa)}
      </td>
    `;
    tablaCalificacionesDocente.appendChild(fila);
  }

  // Recalcular nota final en vivo al editar cualquier input de la fila
  tablaCalificacionesDocente.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const fila = e.target.closest('tr');
      const valores = leerValoresFila(fila);
      fila.querySelector('[data-campo="nota_final"]').textContent = calcularNotaFinal(valores);
    });
  });
}

function leerValoresFila(fila) {
  return {
    nota_ser: fila.querySelector('[data-campo="nota_ser"]').value,
    nota_saber: fila.querySelector('[data-campo="nota_saber"]').value,
    nota_hacer: fila.querySelector('[data-campo="nota_hacer"]').value,
    nota_decidir: fila.querySelector('[data-campo="nota_decidir"]').value,
  };
}

function calcularNotaFinal({ nota_ser, nota_saber, nota_hacer, nota_decidir }) {
  const suma =
    (parseFloat(nota_ser) || 0) +
    (parseFloat(nota_saber) || 0) +
    (parseFloat(nota_hacer) || 0) +
    (parseFloat(nota_decidir) || 0);
  return suma.toFixed(2);
}

btnGuardarNotas.addEventListener('click', async () => {
  const materiaId = selectMateria.value;
  const trimestre = Number(selectTrimestre.value);

  if (!materiaId) {
    mostrarAvisoPanel('Seleccione un curso y una materia antes de guardar.', 'error');
    return;
  }

  const filas = tablaCalificacionesDocente.querySelectorAll('tr');
  const registros = [];

  for (const fila of filas) {
    const estudianteId = fila.dataset.estudianteId;
    const valores = leerValoresFila(fila);

    // Solo se guardan filas con al menos un valor ingresado
    const tieneAlgunValor = Object.values(valores).some((v) => v !== '' && v !== null);
    if (!tieneAlgunValor) continue;

    registros.push({
      estudiante_id: estudianteId,
      materia_id: materiaId,
      trimestre,
      nota_ser: parseFloat(valores.nota_ser) || 0,
      nota_saber: parseFloat(valores.nota_saber) || 0,
      nota_hacer: parseFloat(valores.nota_hacer) || 0,
      nota_decidir: parseFloat(valores.nota_decidir) || 0,
      // nota_final NO se envía: es una columna generada por la base de datos
    });
  }

  if (registros.length === 0) {
    mostrarAvisoPanel('No hay calificaciones para guardar.', 'error');
    return;
  }

  setGuardandoNotas(true);
  ocultarAvisoPanel();

  const { error } = await supabaseClient
    .from('calificaciones')
    .upsert(registros, { onConflict: 'estudiante_id,materia_id,trimestre' });

  setGuardandoNotas(false);

  if (error) {
    console.error('Error al guardar notas:', error);
    mostrarAvisoPanel('No se pudieron guardar las notas. Intente nuevamente.', 'error');
    return;
  }

  mostrarAvisoPanel(`Se guardaron las notas de ${registros.length} estudiante(s).`, 'exito');
  await cargarEstudiantesYContexto(); // refresca con los valores confirmados en BD
});

// =====================================================================
// TAB: OBSERVACIONES
// =====================================================================

function poblarSelectEstudianteObservacion() {
  obsEstudiante.innerHTML = '<option value="">Seleccione un estudiante</option>';

  if (estudiantesCurso.length === 0) {
    sinSeleccionObs.classList.remove('hidden');
    formObservacion.classList.add('hidden');
    return;
  }

  for (const est of estudiantesCurso) {
    const opt = document.createElement('option');
    opt.value = est.id;
    opt.textContent = `${est.apellidos} ${est.nombres} — ${est.numero_kardex}`;
    obsEstudiante.appendChild(opt);
  }

  sinSeleccionObs.classList.add('hidden');
  formObservacion.classList.remove('hidden');
}

formObservacion.addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarAvisoPanel();

  const estudianteId = obsEstudiante.value;
  const tipo = obsTipo.value;
  const descripcion = obsDescripcion.value.trim();

  if (!estudianteId || !descripcion) {
    mostrarAvisoPanel('Complete el estudiante y la descripción antes de registrar.', 'error');
    return;
  }

  setRegistrandoObs(true);

  const { error } = await supabaseClient.from('observaciones').insert({
    estudiante_id: estudianteId,
    docente_id: docenteActual.id,
    tipo,
    descripcion,
  });

  setRegistrandoObs(false);

  if (error) {
    console.error('Error al registrar observación:', error);
    mostrarAvisoPanel('No se pudo registrar la observación. Intente nuevamente.', 'error');
    return;
  }

  mostrarAvisoPanel('Observación registrada correctamente.', 'exito');
  formObservacion.reset();
});

// =====================================================================
// PESTAÑAS
// =====================================================================

tabBtnCalificaciones.addEventListener('click', () => cambiarTab('calificaciones'));
tabBtnObservaciones.addEventListener('click', () => cambiarTab('observaciones'));

function cambiarTab(tab) {
  ocultarAvisoPanel();
  const esCalif = tab === 'calificaciones';

  tabCalificaciones.classList.toggle('hidden', !esCalif);
  tabObservaciones.classList.toggle('hidden', esCalif);

  tabBtnCalificaciones.classList.toggle('tab-activa', esCalif);
  tabBtnCalificaciones.classList.toggle('tab-inactiva', !esCalif);
  tabBtnObservaciones.classList.toggle('tab-activa', !esCalif);
  tabBtnObservaciones.classList.toggle('tab-inactiva', esCalif);
}

// =====================================================================
// UTILIDADES DE UI
// =====================================================================

function mostrarLoginError(texto) {
  loginErrorTexto.textContent = texto;
  loginError.classList.remove('hidden');
}
function ocultarLoginError() {
  loginError.classList.add('hidden');
}
function setCargandoLogin(estado) {
  btnLogin.disabled = estado;
  btnLoginLabel.textContent = estado ? 'Ingresando…' : 'Iniciar sesión';
}

function mostrarAvisoPanel(texto, tipo) {
  panelAviso.textContent = texto;
  panelAviso.classList.remove('hidden', 'border-[#2F6844]', 'bg-[#2F6844]/5', 'text-[#2F6844]', 'border-[#B3401F]', 'bg-[#B3401F]/5', 'text-[#B3401F]');
  if (tipo === 'exito') {
    panelAviso.classList.add('border-[#2F6844]', 'bg-[#2F6844]/5', 'text-[#2F6844]');
  } else {
    panelAviso.classList.add('border-[#B3401F]', 'bg-[#B3401F]/5', 'text-[#B3401F]');
  }
}
function ocultarAvisoPanel() {
  panelAviso.classList.add('hidden');
}

function setGuardandoNotas(estado) {
  btnGuardarNotas.disabled = estado;
  btnGuardarNotasLabel.textContent = estado ? 'Guardando…' : 'Guardar notas';
}

function setRegistrandoObs(estado) {
  btnRegistrarObs.disabled = estado;
  btnRegistrarObsLabel.textContent = estado ? 'Registrando…' : 'Registrar observación';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}