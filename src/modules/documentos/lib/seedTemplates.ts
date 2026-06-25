import type { DocumentTemplate } from './types'

/**
 * Built-in starter templates (Dominican Republic context, Spanish). They are seeded
 * once on first run with stable ids so re-seeding never duplicates. Users can edit or
 * duplicate them; the content is generic and meant to be adjusted to each company.
 *
 * Stamps `createdAt`/`updatedAt` with the provided ISO timestamp (passed in so this
 * stays pure/testable).
 */
export function buildSeedTemplates(nowIso: string): DocumentTemplate[] {
  const base = { isSystem: true, createdAt: nowIso, updatedAt: nowIso }

  return [
    {
      ...base,
      id: 'seed-contrato',
      name: 'Contrato de Trabajo',
      description: 'Contrato laboral por tiempo indefinido (Código de Trabajo RD).',
      title: 'CONTRATO DE TRABAJO',
      body: [
        'Entre {{empresa}}, RNC {{empresa_rnc}}, con domicilio en {{empresa_direccion}}, en lo adelante "LA EMPRESA"; y el/la señor(a) {{nombre}}, portador(a) de la cédula de identidad y electoral No. {{cedula}}, domiciliado(a) en {{direccion}}, en lo adelante "EL/LA TRABAJADOR(A)", se ha convenido el presente contrato de trabajo:',
        'PRIMERO: EL/LA TRABAJADOR(A) se compromete a prestar sus servicios en el cargo de {{cargo}}, dentro del departamento de {{departamento}}.',
        'SEGUNDO: La remuneración acordada es de {{salario}}, pagadera según la política de la empresa, sujeta a las deducciones de ley (TSS e ISR).',
        'TERCERO: El presente contrato inicia en fecha {{fecha_ingreso}} y se rige por las disposiciones del Código de Trabajo de la República Dominicana.',
        'Hecho y firmado en dos (2) originales, en la ciudad de Santo Domingo, a los {{fecha_hoy}}.',
        '\n\n_____________________________\nLA EMPRESA\n\n\n_____________________________\nEL/LA TRABAJADOR(A)',
      ].join('\n\n'),
    },
    {
      ...base,
      id: 'seed-carta-laboral',
      name: 'Carta de Trabajo / Constancia Laboral',
      description: 'Constancia de labores para bancos, embajadas o visas.',
      title: 'CONSTANCIA DE TRABAJO',
      body: [
        'A QUIEN PUEDA INTERESAR:',
        'Por medio de la presente, {{empresa}} (RNC {{empresa_rnc}}) hace constar que el/la señor(a) {{nombre}}, portador(a) de la cédula No. {{cedula}}, labora en nuestra institución desde el {{fecha_ingreso}}, desempeñando el cargo de {{cargo}} en el departamento de {{departamento}}.',
        'Su remuneración actual es de {{salario}}.',
        'La presente constancia se expide a solicitud de la parte interesada, en la ciudad de Santo Domingo, a los {{fecha_hoy}}.',
        'Atentamente,',
        '\n\n_____________________________\nRecursos Humanos\n{{empresa}}\n{{empresa_telefono}}',
      ].join('\n\n'),
    },
    {
      ...base,
      id: 'seed-nda',
      name: 'Acuerdo de Confidencialidad',
      description: 'Acuerdo de confidencialidad (NDA) entre la empresa y el trabajador.',
      title: 'ACUERDO DE CONFIDENCIALIDAD',
      body: [
        'Entre {{empresa}}, RNC {{empresa_rnc}}, en lo adelante "LA EMPRESA", y el/la señor(a) {{nombre}}, cédula No. {{cedula}}, en su calidad de {{cargo}}, en lo adelante "EL/LA TRABAJADOR(A)", se acuerda lo siguiente:',
        'PRIMERO: EL/LA TRABAJADOR(A) reconoce que durante el ejercicio de sus funciones tendrá acceso a información confidencial de LA EMPRESA, sus clientes y socios comerciales.',
        'SEGUNDO: EL/LA TRABAJADOR(A) se obliga a mantener absoluta reserva sobre dicha información y a no divulgarla ni utilizarla para fines distintos a los de su labor, durante la relación laboral y luego de su terminación.',
        'TERCERO: El incumplimiento de este acuerdo facultará a LA EMPRESA a ejercer las acciones legales correspondientes.',
        'Firmado en la ciudad de Santo Domingo, a los {{fecha_hoy}}.',
        '\n\n_____________________________\nEL/LA TRABAJADOR(A)\n{{nombre}}',
      ].join('\n\n'),
    },
    {
      ...base,
      id: 'seed-amonestacion',
      name: 'Carta de Amonestación',
      description: 'Amonestación escrita por incumplimiento (acción de RR.HH.).',
      title: 'CARTA DE AMONESTACIÓN',
      body: [
        'Santo Domingo, {{fecha_hoy}}',
        'Señor(a) {{nombre}}\nCargo: {{cargo}}\nDepartamento: {{departamento}}',
        'Estimado(a) {{primer_nombre}}:',
        'Por medio de la presente, {{empresa}} le notifica formalmente una amonestación escrita en relación con el siguiente hecho: [DESCRIBIR EL HECHO O FALTA].',
        'Le recordamos la importancia de cumplir con las políticas internas y con sus responsabilidades laborales. La reincidencia podrá dar lugar a sanciones adicionales conforme al Código de Trabajo y al reglamento interno.',
        'Esta comunicación forma parte de su expediente laboral.',
        'Atentamente,',
        '\n\n_____________________________\nRecursos Humanos\n{{empresa}}',
      ].join('\n\n'),
    },
  ]
}
