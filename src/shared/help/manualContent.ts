/**
 * Spectra Suite — USER MANUAL (single source of truth).
 *
 * KEEP THIS UPDATED: whenever a feature is added or changed, update the relevant section
 * here so the in-app Help Center (the "?" button) always reflects how the system works.
 *
 * Content is bilingual (EN/ES) inline — it is documentation, selected by the current
 * language, not UI chrome (UI labels live in the locale files). Each section declares who
 * may see it; the Help Center shows only the sections the signed-in user can access.
 */

import {
  Rocket, UserCircle, Trophy, Banknote, Users, ReceiptText, FileText, Kanban,
  Megaphone, ShieldCheck, CalendarDays, type LucideIcon,
} from 'lucide-react'
import type { ModuleId } from '@/shared/types/supabase'

export type ManualLang = 'en' | 'es'
export type Localized = Record<ManualLang, string>

/** Who can see a section. */
export type ManualAccess =
  | { kind: 'everyone' }
  | { kind: 'manager' }
  | { kind: 'superadmin' }
  | { kind: 'module'; module: ModuleId }

export interface ManualBlock {
  heading: Localized
  items: Localized[]
}

export interface ManualSection {
  id: string
  icon: LucideIcon
  title: Localized
  intro: Localized
  blocks: ManualBlock[]
  access: ManualAccess
}

const t = (en: string, es: string): Localized => ({ en, es })

export const MANUAL: ManualSection[] = [
  // ── Getting started ──────────────────────────────────────────────────────
  {
    id: 'getting-started',
    icon: Rocket,
    access: { kind: 'everyone' },
    title: t('Getting started', 'Primeros pasos'),
    intro: t(
      'Spectra Suite brings payroll, HR, invoicing, documents and more into one place. What you see depends on your role.',
      'Spectra Suite reúne nómina, RRHH, facturación, documentos y más en un solo lugar. Lo que ves depende de tu rol.',
    ),
    blocks: [
      {
        heading: t('Signing in & the home screen', 'Iniciar sesión y la pantalla de inicio'),
        items: [
          t('Sign in with your work account. After login you land on the Suite home.', 'Inicia sesión con tu cuenta de trabajo. Al entrar llegas al inicio de la Suite.'),
          t('Managers see module launchers and dashboard widgets; employees see their personal portal.', 'Los managers ven los accesos a módulos y widgets; los empleados ven su portal personal.'),
        ],
      },
      {
        heading: t('Language, theme & your account', 'Idioma, tema y tu cuenta'),
        items: [
          t('Use the EN/ES button to switch language, and the sun/moon to switch light/dark theme.', 'Usa el botón EN/ES para cambiar el idioma y el sol/luna para el tema claro/oscuro.'),
          t('The system always starts in light theme until you choose otherwise.', 'El sistema siempre inicia en tema claro hasta que elijas lo contrario.'),
          t('Open your avatar menu (top-right) for My Profile and to sign out.', 'Abre el menú de tu avatar (arriba a la derecha) para Mi Perfil y para cerrar sesión.'),
        ],
      },
      {
        heading: t('This help button', 'Este botón de ayuda'),
        items: [
          t('Click the "?" button anytime to open this manual. It only shows the parts you have access to.', 'Haz clic en el botón "?" cuando quieras para abrir este manual. Solo muestra las partes a las que tienes acceso.'),
        ],
      },
    ],
  },

  // ── My profile (self-service) ────────────────────────────────────────────
  {
    id: 'my-profile',
    icon: UserCircle,
    access: { kind: 'everyone' },
    title: t('My Profile', 'Mi Perfil'),
    intro: t(
      'Your self-service profile shows your personal, job and compensation information.',
      'Tu perfil de autoservicio muestra tu información personal, laboral y de compensación.',
    ),
    blocks: [
      {
        heading: t('What you can see', 'Qué puedes ver'),
        items: [
          t('Open "My Profile" from your home or the avatar menu.', 'Abre "Mi Perfil" desde tu inicio o el menú del avatar.'),
          t('Tabs: Personal, Job, Baseball Card, Compensation, Time Off and Emergency contacts.', 'Pestañas: Personal, Puesto, Baseball Card, Compensación, Tiempo libre y Contactos de emergencia.'),
          t('Notes and Documents are not shown in the self-service view.', 'Las Notas y los Documentos no se muestran en la vista de autoservicio.'),
        ],
      },
      {
        heading: t('If your profile is not linked', 'Si tu perfil no está vinculado'),
        items: [
          t('Your profile is matched by your email. If you see "profile not linked", contact your administrator.', 'Tu perfil se vincula por tu correo. Si ves "perfil no vinculado", contacta a tu administrador.'),
        ],
      },
    ],
  },

  // ── Portal: rewards & news ─────────────────────────────────────────────────
  {
    id: 'portal-rewards-news',
    icon: Trophy,
    access: { kind: 'everyone' },
    title: t('Daily rewards & news', 'Premios diarios y noticias'),
    intro: t(
      'On your home you may see a news board and a daily-rewards widget (when enabled by the admin).',
      'En tu inicio puedes ver un tablero de noticias y un widget de premios diarios (cuando el admin lo activa).',
    ),
    blocks: [
      {
        heading: t('Daily rewards', 'Premios diarios'),
        items: [
          t('Log in each day to earn points and grow your streak; badges unlock at 3, 7, 30 and 100 days.', 'Entra cada día para ganar puntos y aumentar tu racha; las medallas se desbloquean a los 3, 7, 30 y 100 días.'),
          t('You can only check in once per day.', 'Solo puedes registrar entrada una vez por día.'),
        ],
      },
      {
        heading: t('News board', 'Tablero de noticias'),
        items: [
          t('Announcements posted by managers appear here, with pinned items first.', 'Los anuncios publicados por los managers aparecen aquí, con los fijados primero.'),
        ],
      },
    ],
  },

  // ── Company calendar ───────────────────────────────────────────────────────
  {
    id: 'company-calendar',
    icon: CalendarDays,
    access: { kind: 'everyone' },
    title: t('Company calendar', 'Calendario de la empresa'),
    intro: t(
      'A shared calendar with company activities and everyone\'s birthdays.',
      'Un calendario compartido con las actividades de la empresa y los cumpleaños de todos.',
    ),
    blocks: [
      {
        heading: t('Viewing', 'Ver'),
        items: [
          t('Open "Calendar" from the home header, or "Open calendar" from the Today widget.', 'Abre "Calendario" desde el encabezado del inicio, o "Abrir calendario" desde el widget de Hoy.'),
          t('The month grid shows birthdays (cake icon) and events on each day; use the arrows to change month.', 'La cuadrícula del mes muestra cumpleaños (icono de pastel) y eventos en cada día; usa las flechas para cambiar de mes.'),
          t('The "Today" widget on your home highlights who has a birthday today and today\'s events.', 'El widget "Hoy" en tu inicio destaca quién cumple años hoy y los eventos del día.'),
        ],
      },
      {
        heading: t('Managing events (managers)', 'Gestionar eventos (managers)'),
        items: [
          t('Managers can add an event with "Add event" or by clicking a day, and edit/delete by clicking an event.', 'Los managers pueden agregar un evento con "Agregar evento" o haciendo clic en un día, y editar/eliminar haciendo clic en un evento.'),
          t('Birthdays come automatically from employee records and cannot be edited here.', 'Los cumpleaños vienen automáticamente de los registros de empleados y no se editan aquí.'),
        ],
      },
    ],
  },

  // ── Nómina (payroll) ────────────────────────────────────────────────────
  {
    id: 'nomina',
    icon: Banknote,
    access: { kind: 'module', module: 'nomina' },
    title: t('Payroll (Nómina)', 'Nómina'),
    intro: t(
      'Process payroll for hourly employees following Dominican Republic tax law (TSS + ISR), and other countries.',
      'Procesa la nómina de empleados por hora según la ley fiscal dominicana (TSS + ISR) y otros países.',
    ),
    blocks: [
      {
        heading: t('Processing a payroll', 'Procesar una nómina'),
        items: [
          t('Step 1 — Period: pick the country, the pay frequency and the period dates.', 'Paso 1 — Período: elige el país, la frecuencia de pago y las fechas del período.'),
          t('Step 2 — Hours: review/adjust each employee\'s regular, overtime and holiday hours.', 'Paso 2 — Horas: revisa/ajusta las horas regulares, extra y de feriado de cada empleado.'),
          t('Step 3 — Calculate: review gross, TSS, ISR and net totals before approving.', 'Paso 3 — Calcular: revisa los totales de bruto, TSS, ISR y neto antes de aprobar.'),
          t('Step 4 — Approve: finalize the run. Approved runs are saved to the database.', 'Paso 4 — Aprobar: finaliza la corrida. Las corridas aprobadas se guardan en la base de datos.'),
          t('The Pay Date shown on the paystubs is editable at approval (defaults to today) — it does not have to be the processing date. The single-stub preview also lets you set it.', 'La Fecha de Pago que aparece en los comprobantes es editable al aprobar (por defecto hoy) — no tiene que ser la fecha de procesamiento. La vista previa de comprobante individual también permite ajustarla.'),
        ],
      },
      {
        heading: t('Hours & rates', 'Horas y tarifas'),
        items: [
          t('Total hours pay at 100% of the rate; overtime adds a 50% differential; holidays add 100%.', 'El total de horas se paga al 100% de la tarifa; el OT agrega 50% de diferencial; los feriados agregan 100%.'),
        ],
      },
      {
        heading: t('Deductions', 'Deducciones'),
        items: [
          t('Custom deductions (fixed or % of gross) are configured per employee in Employees.', 'Las deducciones personalizadas (fijas o % del bruto) se configuran por empleado en Empleados.'),
          t('Insurance dependents registered in RRHH feed the "Dependent TSS" and "Complementary Insurance" deductions automatically: the monthly cost is prorated per pay period and replaces any same-named manual deduction.', 'Los dependientes de seguro registrados en RRHH alimentan las deducciones "Dependent TSS" y "Seguro Complementario" automáticamente: el costo mensual se prorratea por período de pago y reemplaza cualquier deducción manual con el mismo nombre.'),
        ],
      },
      {
        heading: t('Currency & exchange rate', 'Moneda y tasa de cambio'),
        items: [
          t('Totals show in the country currency and in USD. The "Rate of the day" badge shows the live USD rate.', 'Los totales se muestran en la moneda del país y en USD. El badge "Tasa del día" muestra la tasa USD en vivo.'),
          t('The rate is frozen into each run when approved, so historical USD totals stay stable.', 'La tasa se congela en cada corrida al aprobarla, así los totales históricos en USD se mantienen estables.'),
        ],
      },
      {
        heading: t('History & reports', 'Historial y reportes'),
        items: [
          t('Open History to review past runs, expand a run for the per-employee breakdown, and export the manager report (PDF/CSV).', 'Abre el Historial para revisar corridas pasadas, expandir una corrida para el desglose por empleado y exportar el reporte gerencial (PDF/CSV).'),
          t('An approved run can be reopened and edited by an admin (audited).', 'Una corrida aprobada puede reabrirse y editarse por un admin (queda auditado).'),
          t('The Reports section has the TSS Payment Report: pick a month and get each employee\'s contributory salary (all earnings except overtime and holiday premiums), SFS, AFP and total TSS, exportable to PDF/CSV.', 'La sección Reportes tiene el Reporte de Pago TSS: elige un mes y obtén el salario cotizable de cada empleado (todos los ingresos excepto recargos de horas extras y feriados), SFS, AFP y total TSS, exportable a PDF/CSV.'),
          t('The Other Remunerations Report is its complement: the month\'s overtime and holiday premiums per employee (hours and amounts), exportable to PDF/CSV.', 'El Reporte de Otras Remuneraciones es su complemento: los recargos de horas extras y feriados del mes por empleado (horas y montos), exportable a PDF/CSV.'),
        ],
      },
    ],
  },

  // ── RRHH (HR) ─────────────────────────────────────────────────────────────
  {
    id: 'rrhh',
    icon: Users,
    access: { kind: 'module', module: 'rrhh' },
    title: t('Human Resources (RRHH)', 'Recursos Humanos (RRHH)'),
    intro: t(
      'The employee directory and profiles, synced from BambooHR and persisted in the database.',
      'El directorio de empleados y los perfiles, sincronizados desde BambooHR y guardados en la base de datos.',
    ),
    blocks: [
      {
        heading: t('Directory & profiles', 'Directorio y perfiles'),
        items: [
          t('Browse the directory and open an employee to see Personal, Job, Compensation, Time Off, Emergency, Notes and Documents.', 'Explora el directorio y abre un empleado para ver Personal, Puesto, Compensación, Tiempo libre, Emergencia, Notas y Documentos.'),
          t('Sensitive data (full national ID, compensation, documents) requires elevated access.', 'Los datos sensibles (cédula completa, compensación, documentos) requieren acceso elevado.'),
        ],
      },
      {
        heading: t('Photos', 'Fotos'),
        items: [
          t('Photos are stored in the database on sync; they load from there, not from BambooHR each time.', 'Las fotos se guardan en la base de datos al sincronizar; se cargan desde ahí, no desde BambooHR cada vez.'),
          t('Admins can upload or remove a custom photo, which always wins over the BambooHR one.', 'Los admins pueden subir o quitar una foto personalizada, que siempre prevalece sobre la de BambooHR.'),
        ],
      },
      {
        heading: t('Documents', 'Documentos'),
        items: [
          t('Documents are organized in folders; you can create folders and move documents within the app.', 'Los documentos se organizan en carpetas; puedes crear carpetas y mover documentos dentro de la app.'),
          t('Tax exemption can be set per employee (admin/payroll only).', 'La exención de impuestos se puede configurar por empleado (solo admin/nómina).'),
        ],
      },
      {
        heading: t('Insurance dependents', 'Dependientes de seguro'),
        items: [
          t('The Dependents tab on the employee profile tracks who is covered, in two groups: TSS Dependents (additional) and Complementary Insurance.', 'La pestaña Dependientes del perfil del empleado registra quién está cubierto, en dos grupos: Dependientes TSS (adicionales) y Seguro Complementario.'),
          t('Each dependent records name, relationship, ID (cédula), date of birth, gender and monthly cost. Users with sensitive-data access can add, edit and remove them; employees see their own dependents read-only.', 'Cada dependiente registra nombre, parentesco, cédula, fecha de nacimiento, sexo y costo mensual. Los usuarios con acceso a datos sensibles pueden agregarlos, editarlos y eliminarlos; los empleados ven sus propios dependientes en solo lectura.'),
          t('The monthly costs feed Payroll automatically: each coverage\'s total becomes the employee\'s "Dependent TSS" / "Complementary Insurance" deduction, prorated per pay period (biweekly ÷ 2, weekly ÷ 4, full month × 1) and replacing any same-named manual deduction.', 'Los costos mensuales alimentan Nómina automáticamente: el total de cada cobertura se convierte en la deducción "Dependent TSS" / "Seguro Complementario" del empleado, prorrateada por período de pago (quincenal ÷ 2, semanal ÷ 4, mes completo × 1) y reemplazando cualquier deducción manual con el mismo nombre.'),
        ],
      },
    ],
  },

  // ── Facturación (billing) ─────────────────────────────────────────────────
  {
    id: 'facturacion',
    icon: ReceiptText,
    access: { kind: 'module', module: 'facturacion' },
    title: t('Invoicing (Facturación)', 'Facturación'),
    intro: t(
      'Bill clients for staff labor, using finalized payroll data. All invoicing is in USD.',
      'Factura a los clientes por el trabajo del personal, usando datos de nómina finalizados. Toda la facturación es en USD.',
    ),
    blocks: [
      {
        heading: t('Clients', 'Clientes'),
        items: [
          t('Each BambooHR division becomes a client; employees are auto-assigned to their client.', 'Cada división de BambooHR se vuelve un cliente; los empleados se asignan automáticamente a su cliente.'),
        ],
      },
      {
        heading: t('Invoices', 'Facturas'),
        items: [
          t('Create an invoice for a client and period; it pulls the finalized payroll for that range.', 'Crea una factura para un cliente y período; toma la nómina finalizada de ese rango.'),
          t('Invoices are draft until finalized; finalizing assigns the invoice number.', 'Las facturas están en borrador hasta finalizarse; al finalizar se asigna el número de factura.'),
          t('The invoice number is the client prefix + the invoice date (MMDDYYYY), e.g. RM02162026. Set each client\'s prefix in Clients.', 'El número de factura es el prefijo del cliente + la fecha (MMDDYYYY), ej. RM02162026. Define el prefijo de cada cliente en Clientes.'),
          t('Add incentives/bonuses per employee before finalizing (KPI Bonus, Team Contest, etc.).', 'Agrega incentivos/bonos por empleado antes de finalizar (KPI Bonus, Team Contest, etc.).'),
        ],
      },
      {
        heading: t('Invoice PDF', 'PDF de la factura'),
        items: [
          t('The PDF groups Base Pay and Overtime by role/rate, lists bonuses per person, and shows the Invoice Total.', 'El PDF agrupa Base Pay y Overtime por rol/tarifa, lista los bonos por persona y muestra el Total de Factura.'),
          t('A second "Hours Detail" page lists each employee\'s total worked, base and overtime hours.', 'Una segunda página de "Detalle de Horas" lista por empleado las horas trabajadas, base y extra.'),
        ],
      },
    ],
  },

  // ── Documentos ─────────────────────────────────────────────────────────────
  {
    id: 'documentos',
    icon: FileText,
    access: { kind: 'module', module: 'documentos' },
    title: t('Documents (Documentos)', 'Documentos'),
    intro: t(
      'Generate company documents (contracts, letters) filled from employee HR data.',
      'Genera documentos de la empresa (contratos, cartas) llenados con los datos de RRHH del empleado.',
    ),
    blocks: [
      {
        heading: t('Working by country', 'Trabajar por país'),
        items: [
          t('Select the country first; you then see only the templates and documents for that country.', 'Selecciona primero el país; luego ves solo las plantillas y documentos de ese país.'),
        ],
      },
      {
        heading: t('Generating', 'Generar'),
        items: [
          t('Pick a template and an employee; choose page size (Letter/Legal) and margins before generating.', 'Elige una plantilla y un empleado; selecciona el tamaño de hoja (Carta/Legal) y los márgenes antes de generar.'),
          t('Generated documents are kept in History.', 'Los documentos generados se guardan en el Historial.'),
        ],
      },
    ],
  },

  // ── Tablero (kanban) ─────────────────────────────────────────────────────
  {
    id: 'tablero',
    icon: Kanban,
    access: { kind: 'module', module: 'tablero' },
    title: t('Boards (Tablero)', 'Tablero'),
    intro: t(
      'A Trello-style kanban for managers to organize work across teams.',
      'Un kanban estilo Trello para que los managers organicen el trabajo de los equipos.',
    ),
    blocks: [
      {
        heading: t('Boards, lists & cards', 'Tableros, listas y tarjetas'),
        items: [
          t('Create boards; inside a board add lists (columns) and cards.', 'Crea tableros; dentro de un tablero agrega listas (columnas) y tarjetas.'),
          t('Open a card to set description, assignee, due date, color labels, checklist and comments.', 'Abre una tarjeta para definir descripción, responsable, fecha límite, etiquetas de color, checklist y comentarios.'),
          t('Drag a card between lists to move it. Changes are shared with all managers.', 'Arrastra una tarjeta entre listas para moverla. Los cambios se comparten con todos los managers.'),
        ],
      },
    ],
  },

  // ── News management (managers) ────────────────────────────────────────────
  {
    id: 'news-management',
    icon: Megaphone,
    access: { kind: 'manager' },
    title: t('Managing news', 'Gestionar noticias'),
    intro: t(
      'Managers can publish announcements that employees see on their portal.',
      'Los managers pueden publicar anuncios que los empleados ven en su portal.',
    ),
    blocks: [
      {
        heading: t('Posting', 'Publicar'),
        items: [
          t('Open "News" from the Suite home, then create, edit, pin or delete posts.', 'Abre "Noticias" desde el inicio de la Suite; luego crea, edita, fija o elimina publicaciones.'),
          t('Pinned posts appear first on the employee news board.', 'Las publicaciones fijadas aparecen primero en el tablero de noticias del empleado.'),
        ],
      },
    ],
  },

  // ── Suite administration (super admin) ────────────────────────────────────
  {
    id: 'suite-admin',
    icon: ShieldCheck,
    access: { kind: 'superadmin' },
    title: t('Suite administration', 'Administración de la Suite'),
    intro: t(
      'Super-admin settings that apply to the whole company.',
      'Configuraciones de súper administrador que aplican a toda la empresa.',
    ),
    blocks: [
      {
        heading: t('Users, roles & access', 'Usuarios, roles y acceso'),
        items: [
          t('Manage users and roles, and which modules each role can view/edit.', 'Gestiona usuarios y roles, y qué módulos puede ver/editar cada rol.'),
        ],
      },
      {
        heading: t('Module visibility & rewards', 'Visibilidad de módulos y premios'),
        items: [
          t('Hide modules from everyone with the module-visibility switches.', 'Oculta módulos para todos con los interruptores de visibilidad de módulos.'),
          t('Turn the daily-rewards system on or off.', 'Activa o desactiva el sistema de premios diarios.'),
        ],
      },
      {
        heading: t('Fiscal parameters & connectors', 'Parámetros fiscales y conectores'),
        items: [
          t('Configure per-country taxes (deductions + income-tax brackets) and the TSS/ISR scale.', 'Configura los impuestos por país (deducciones + tramos de renta) y la escala TSS/ISR.'),
          t('Connect BambooHR and Hubstaff in Connectors. All settings persist in the database, shared across users.', 'Conecta BambooHR y Hubstaff en Conectores. Toda la configuración se guarda en la base de datos, compartida entre usuarios.'),
        ],
      },
    ],
  },
]
