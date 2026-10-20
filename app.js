// Configuración de Supabase con tu URL real
const SUPABASE_URL = 'https://aspjkfgocyeitvvnumiq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzcGprZmdvY3llaXR2dm51bWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njg0MzgsImV4cCI6MjEwNjE0NDQzOH0.Mw6tsbeNgYMIYYlPh34gx9m3N3BiT6Ncs094fseYxOM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// --- Referencias al DOM ----------------------------------------------
const form = document.getElementById('form-kardex');
const btnConsultar = document.getElementById('btn-consultar');
const btnLabel = document.getElementById('btn-label');

const mensajeError = document.getElementById('mensaje-error');
const mensajeErrorTexto = document.getElementById('mensaje-error-texto');
const resultados = document.getElementById('resultados');

const elNombreCompleto = document.getElementById('est-nombre-completo');
const elKardex = document.getElementById('est-kardex');
const elNivel = document.getElementById('est-nivel');
const elGrado = document.getElementById('est-grado');
const elParalelo = document.getElementById('est-paralelo');

const tablaCalificaciones = document.getElementById('tabla-calificaciones');
const sinCalificaciones = document.getElementById('sin-calificaciones');

const listaObservaciones = document.getElementById('lista-observaciones');
const sinObservaciones = document.getElementById('sin-observaciones');

// --- Envío del formulario ----------------------------------------------
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarError();

  const numeroKardex = document.getElementById('numero_kardex').value.trim();
  const ciTutor = document.getElementById('ci_tutor').value.trim();

  if (!numeroKardex || !ciTutor) {
    mostrarError('Complete el número de Kárdex y el C.I. del tutor.');
    return;
  }

  setCargando(true);
  resultados.classList.add('hidden');

  try {
    const { data, error } = await supabaseClient.rpc('consultar_kardex', {
      p_numero_kardex: numeroKardex,
      p_ci_tutor: ciTutor,
    });

    if (error) {
      console.error('Error de Supabase:', error);
      mostrarError('No se pudo completar la consulta. Intente nuevamente en unos minutos.');
      return;
    }

    if (!data) {
      mostrarError('No se encontró un estudiante con esos datos. Verifique el número de Kárdex y el C.I. del tutor.');
      return;
    }

    renderizarResultado(data);
  } catch (err) {
    console.error('Error inesperado:', err);
    mostrarError('Ocurrió un error de conexión. Verifique su internet e intente de nuevo.');
  } finally {
    setCargando(false);
  }
});

// --- Renderizado ---------------------------------------------------------
function renderizarResultado(data) {
  const est = data.estudiante;
  const calificaciones = data.calificaciones || [];
  const observaciones = data.observaciones || [];

  elNombreCompleto.textContent = `${est.nombres} ${est.apellidos}`;
  elKardex.textContent = est.numero_kardex;
  elNivel.textContent = est.curso?.nivel ?? '—';
  elGrado.textContent = est.curso ? `${est.curso.grado}°` : '—';
  elParalelo.textContent = est.curso?.paralelo ?? '—';

  renderizarCalificaciones(calificaciones);
  renderizarObservaciones(observaciones);

  resultados.classList.remove('hidden');
  resultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderizarCalificaciones(calificaciones) {
  tablaCalificaciones.innerHTML = '';

  if (calificaciones.length === 0) {
    sinCalificaciones.classList.remove('hidden');
    return;
  }
  sinCalificaciones.classList.add('hidden');

  for (const c of calificaciones) {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="py-2.5 pr-3">
        ${escapeHtml(c.materia)}
        ${c.es_tecnica ? '<span class="ml-1 text-[10px] uppercase tracking-wide text-oro-700 align-middle">Técnica</span>' : ''}
      </td>
      <td class="py-2.5 px-3 text-center">${c.trimestre}</td>
      <td class="py-2.5 px-3 text-center">${formatearNota(c.nota_ser)}</td>
      <td class="py-2.5 px-3 text-center">${formatearNota(c.nota_saber)}</td>
      <td class="py-2.5 px-3 text-center">${formatearNota(c.nota_hacer)}</td>
      <td class="py-2.5 px-3 text-center">${formatearNota(c.nota_decidir)}</td>
      <td class="py-2.5 pl-3 text-right font-semibold text-institucional-900">${formatearNota(c.nota_final)}</td>
    `;
    tablaCalificaciones.appendChild(fila);
  }
}

function renderizarObservaciones(observaciones) {
  listaObservaciones.innerHTML = '';

  if (observaciones.length === 0) {
    sinObservaciones.classList.remove('hidden');
    return;
  }
  sinObservaciones.classList.add('hidden');

  for (const o of observaciones) {
    const esAcademica = o.tipo === 'Academica';
    const tarjeta = document.createElement('div');
    tarjeta.className = 'border-l-4 pl-4 py-2 ' + (esAcademica ? 'border-institucional-500' : 'border-oro-600');
    tarjeta.innerHTML = `
      <div class="flex items-center justify-between gap-3 text-xs text-[#1F2937]/50 mb-1">
        <span class="font-medium ${esAcademica ? 'text-institucional-700' : 'text-oro-700'}">
          ${esAcademica ? 'Académica' : 'Conductual'}
        </span>
        <span>${formatearFecha(o.fecha)}</span>
      </div>
      <p class="text-sm leading-snug">${escapeHtml(o.descripcion)}</p>
      <p class="text-xs text-[#1F2937]/40 mt-1">Registrado por ${escapeHtml(o.docente)}</p>
    `;
    listaObservaciones.appendChild(tarjeta);
  }
}

// --- Utilidades ---------------------------------------------------------
function mostrarError(texto) {
  mensajeErrorTexto.textContent = texto;
  mensajeError.classList.remove('hidden');
}

function ocultarError() {
  mensajeError.classList.add('hidden');
}

function setCargando(estado) {
  btnConsultar.disabled = estado;
  btnLabel.textContent = estado ? 'Consultando…' : 'Consultar boletín';
}

function formatearNota(valor) {
  if (valor === null || valor === undefined) return '—';
  const n = Number(valor);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(fechaISO + 'T00:00:00');
  return fecha.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}