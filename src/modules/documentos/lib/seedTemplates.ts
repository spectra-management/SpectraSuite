import type { DocumentTemplate } from './types'

/**
 * Built-in templates — transcribed from Spectra's official company documents (DR, Spanish).
 * Fixed legal text is kept verbatim; only the per-employee blanks were turned into
 * {{variables}} (filled from HR data + dates). Users can edit or duplicate them.
 *
 * Seeded once per workspace with stable ids; `buildSeedTemplates(nowIso)` stamps timestamps
 * (passed in to keep this pure/testable). The "Update built-in templates" action re-applies
 * these by id, so editing the wording here propagates on the user's click.
 */
export function buildSeedTemplates(nowIso: string): DocumentTemplate[] {
  const base = { isSystem: true, createdAt: nowIso, updatedAt: nowIso }

  return [
    {
      ...base,
      id: 'seed-contrato',
      name: 'Contrato de Trabajo (Teletrabajo)',
      description: 'Contrato por tiempo indefinido bajo modalidad de teletrabajo (WFH).',
      title: 'CONTRATO DE TRABAJO POR TIEMPO INDEFINIDO',
      body: [
        'ENTRE: De una parte, la sociedad SPECTRA HEALTH CARE MANAGEMENT S.R.L., debidamente organizada y existente de conformidad con las leyes de la República Dominicana, con su domicilio social ubicado en la Av. Juan Pablo Duarte, esquina Entrada Cerros del Castillo, de esta ciudad de Santiago de los Caballeros, República Dominicana, con Registro Nacional de Contribuyentes (RNC) No. 1-32-08245-1 y Registro Nacional Laboral No. 132082451-0001, debidamente representada, para los fines del presente acto, por su gerente general, la señora RESLINE DORCENT, de nacionalidad haitiana, mayor de edad, titular del pasaporte No. GV4615595, domiciliada y residente en esta ciudad de Santiago de los Caballeros, República Dominicana; sociedad que en lo adelante se denominará por su nombre completo o como "LA EMPRESA"; y de la otra parte, {{trato}} {{nombre}}, de nacionalidad Dominicana, mayor de edad, portador(a) de la cédula de identidad y electoral No. {{cedula}}, y domiciliado(a) en {{direccion}}, República Dominicana; quien en lo adelante se denominará por sus propios nombres y apellidos o como "EL (LA) TRABAJADOR(A)". En conjunto, "LA EMPRESA" y "EL (LA) TRABAJADOR(A)" se denominarán, "LAS PARTES".',
        'LAS PARTES CONVIENEN, LIBRE Y VOLUNTARIAMENTE, LO SIGUIENTE:',
        'PRIMERO: EL(LA) TRABAJADOR(A) se compromete, libre y voluntariamente, a desempeñar, a partir del {{fecha_ingreso}}, por tiempo indefinido las labores de {{cargo}}; y bajo la subordinación y dirección de ésta y/o de sus representantes.',
        'SEGUNDO: La ejecución del presente contrato se llevará a cabo bajo la modalidad de teletrabajo y EL(LA) TRABAJADOR(A) la realizará desde su domicilio ubicado en {{direccion}}, República Dominicana; así como también en cualquier otro lugar que LA EMPRESA o su representante designe o estime conveniente para ello.',
        'PÁRRAFO: EL(LA) TRABAJADOR(A) reconoce y declara que deberá asistir de manera presencial a las instalaciones de LA EMPRESA para reuniones y entrenamientos todas las veces que le sea requerido, así como, a realizar y estar presente en todas las reuniones a través de videoconferencias, llamadas telefónicas con LA EMPRESA y que en ningún caso se entiende como violación del domicilio privado.',
        'TERCERO: Para poder realizar sus labores, LA EMPRESA ha entregado personalmente y puesto a disposición de EL(LA) TRABAJADOR(A), tal y como lo reconoce, todas las herramientas, redes, dispositivos, softwares y servicios que permiten la ejecución del contrato a distancia o teletrabajo, todo lo cual EL(LA) TRABAJADOR(A) se ha comprometido a utilizar única y exclusivamente para fines laborales, no pudiendo utilizarlo en ningún caso para temas personales, incluyendo pero no limitándose a redes sociales, diversión o cualquier otra finalidad distinta a la ejecución de este contrato, así mismo se obliga a cuidar y salvaguardar los mismos, evitando el uso de estos por parte de terceros. Además, se compromete a asegurar la confidencialidad de los datos suministrados, quedando estrictamente prohibido tomar fotos, videos y/o capturas de pantalla de la información y/o software o herramientas, so pena de ejecución del Acuerdo de Confidencialidad convenido. En caso de terminación de contrato de trabajo EL(LA) TRABAJADOR(A) se obliga y compromete a devolver íntegramente y en buen estado, todas las herramientas, redes, dispositivos, softwares que le fueron entregadas al momento de iniciar la relación laboral, así como a entregar a SPECTRA HEALTH CARE MANAGEMENT S.R.L., todo material escrito, documentos, instrumentos y otros objetos tangibles, que sean de su prioridad, incluyendo copias de documentos preparadas o compiladas por EL(LA) TRABAJADOR(A) o que hayan sido puestas a su disposición durante el transcurso del empleo.',
        'PÁRRAFO I: EL(LA) TRABAJADOR(A) se obliga y compromete a tener un respaldo de energía para asegurar que durante la ejecución de sus labores las mismas no se vean afectadas o interrumpidas por falta o falla de energía eléctrica, a tener el internet requerido por LA EMPRESA, así como, se compromete a garantizar que el teletrabajo se realice en un lugar donde no exista ningún tipo de ruido y se cumpla con las condiciones de higiene y seguridad dispuestas por la normativa vigente, acogiéndose a todas las guías, políticas y manuales que se comuniquen al respecto. En caso de fallas en el respaldo de energía, internet o su capacidad requerida, existencia de ruido y/o situaciones de incumplimiento de las normas de higiene y seguridad dispuestas, EL(LA) TRABAJADOR(A) reconoce que deberá asistir a laborar de manera presencial en las instalaciones de la empresa hasta que sea corregida la falla existente.',
        'CUARTO: Como contraprestación del servicio, las partes han convenido que EL(LA) TRABAJADOR(A) devengará un salario fijo por hora de {{salario_letras}} (RD${{salario_hora}}*).',
        'PÁRRAFO I: EL(LA) TRABAJADOR(A) autoriza a la empresa a efectuar el pago de esta suma, así como de cualquier otra resultante de la relación laboral existente, mediante transferencia bancaria electrónica realizada en la cuenta de EL(LA) TRABAJADOR(A), en el Banco Popular Dominicano.',
        'PÁRRAFO II: EL(LA) TRABAJADOR(A), además, autoriza a que se deposite en esta cuenta bancaria los montos que eventualmente pudieran corresponderle con motivo de la terminación de su contrato de trabajo. Este depósito se realizará siempre y cuando EL(LA) TRABAJADOR(A) no pueda presentarse físicamente a recibir los montos que pudieran corresponderle.',
        'PÁRRAFO III: EL(LA) TRABAJADOR(A), autoriza a LA EMPRESA a realizarle todos los descuentos y deducciones que las leyes dominicanas contemplen deban realizarse sobre las sumas recibidas como consecuencia del contrato de trabajo que los une.',
        'QUINTO: LAS PARTES, de mutuo acuerdo y por convenir a sus intereses, han decidido establecer una jornada corrida de trabajo, comprometiéndose EL(LA) TRABAJADOR(A) a laborar de ____________________; debiendo cumplir con sus horas normales de trabajo diaria y semanal, siempre debiendo tomar el descanso intermedio convenido y para almuerzo, así como, el descanso semanal correspondiente, haciendo uso de la DESCONEXIÓN DIGITAL, que no es más que es el derecho que le asiste a la persona trabajadora de no contestar requerimientos o mensajes fuera de su jornada habitual de trabajo, a excepción de las situaciones de emergencias, todo en observancia del Código de Trabajo y la Resolución 23-2020. No obstante, de acuerdo con las necesidades de LA EMPRESA, se podrá establecer una jornada de trabajo especial.',
        'PÁRRAFO: LA EMPRESA y EL(LA) TRABAJADOR(A) convienen que LA EMPRESA tendrá derecho a variar la jornada de trabajo diaria o semanal, de manera provisional o permanente, así como, también el descanso semanal de EL(LA) TRABAJADOR(A), cada vez que fuere necesario hacerlo o en virtud de la puesta en vigor de un nuevo sistema de jornada de trabajo autorizado por las autoridades competentes.',
        'SEXTO: LA EMPRESA exige como condición fundamental para la firma del presente contrato, que EL(LA) TRABAJADOR(A) mantenga las especificaciones de calidad del servicio preestablecidas, por lo que cualquier situación, comportamiento, actitud, disposición o falta de cooperación de EL(LA) TRABAJADOR(A) para obtener dichos fines será considerado por LA EMPRESA como una falta grave que justifica su amonestación, la anotación de dichas faltas en el récord permanente de EL(LA) TRABAJADOR(A) e incluso la terminación de su contrato de trabajo. EL(LA) TRABAJADOR(A) declara y reconoce por este medio tener conocimiento de lo anteriormente expuesto.',
        'SÉPTIMO: LAS PARTES acuerdan que LA EMPRESA tendrá derecho a introducir cualquier cambio al presente contrato de trabajo, incluyendo cambio de posiciones, funciones, lugar, jornadas de trabajo, etc., cuando LA EMPRESA así lo estime necesario y no entrañe un perjuicio moral o económico para EL(LA) TRABAJADOR(A).',
        'OCTAVO: Como elemento esencial a la concertación y conclusión del presente contrato, EL(LA) TRABAJADOR(A) reconoce y admite que toda información, fórmula, proceso, método, experticio, diseño, aparato o equipo, costos, información personal y confidencial de los clientes y/o afiliados, a que tuviere acceso EL(LA) TRABAJADOR(A) en razón de sus labores, es y constituye información privilegiada y confidencial de la propiedad exclusiva de LA EMPRESA, por lo que EL(LA) TRABAJADOR(A) se compromete a no utilizar a fines distintos para los cuales ha sido proporcionada y a no revelar o permitir que sea revelado, a ningún tercero, a excepción de aquellos empleados o gerentes de LA EMPRESA autorizados para ello, durante la vigencia de su empleo y aún posterior a la conclusión de este contrato, ninguna de las informaciones antes descritas. La violación de la presente disposición conllevará la inmediata terminación del presente contrato, con responsabilidad para EL(LA) TRABAJADOR(A), sin desmedro de la responsabilidad civil o penal en que pudiere incurrir EL(LA) TRABAJADOR(A) posteriormente a la terminación del mismo.',
        'NOVENO: EL(LA) TRABAJADOR(A) se obliga y compromete a no prestar servicios directos o indirectos para empresas clientes o suplidores de LA EMPRESA y/o empresas que ofrezcan el mismo servicio a las que se dedica LA EMPRESA, por un período de dos (2) años después de concluida la relación laboral. La inobservancia de EL(LA) TRABAJADOR(A) a la disposición anterior, comprometería su responsabilidad civil.',
        'DÉCIMO: Para los fines del presente contrato, las partes eligen formal domicilio en sus respectivos domicilios anteriormente indicados.',
        'PÁRRAFO: LAS PARTES acuerdan que en caso de que una de ellas, cambie el domicilio de elección antes indicado, no le será oponible a la otra parte, si el mismo no le hubiere sido oportunamente comunicado mediante acto de alguacil, comunicación simple o correo electrónico, debidamente firmado en señal de recepción, por la otra parte.',
        'DÉCIMO PRIMERO: LAS PARTES envueltas en la modalidad de teletrabajo, reconocen y tienen conocimiento que como una forma de regular y garantizar los derechos y obligaciones el Ministerio de Trabajo, emitió la Resolución 23-2020, antes indicada, definiendo éste: como la modalidad especial de trabajo que se presta a distancia, ya sea de forma parcial o total, haciendo uso de herramientas vinculadas a las tecnologías de la información y comunicación; por ende, LAS PARTES formalizan por escrito toda la situación.',
        'DÉCIMO SEGUNDO: Todo lo no previsto en el presente contrato se regirá de acuerdo a los lineamientos legales establecidos en el Código de Trabajo Dominicano y por el Derecho Común y con mi firma certifico que he recibido una copia íntegra de mi contrato de trabajo.',
        'DÉCIMO TERCERO: EL(LA) TRABAJADOR(A) declara que ha suscrito el presente contrato de trabajo de manera libre y voluntaria y que no ha sido objeto, en modo alguno, de coerción, presión ni violencia imputable a LA EMPRESA; y que por el contrario, la suscripción del presente acto se traduce en la expresión de su expresa voluntad.',
        'HECHO Y FIRMADO de buena fe, en cuatro (4) originales, uno para cada una de las partes y uno para los fines legales correspondientes. En la ciudad de Santiago de los Caballeros, municipio y provincia de Santiago, República Dominicana, {{fecha_legal}}.',
        '\n\n_________________________________\n{{nombre}}\nEL (LA) TRABAJADOR(A)\n\n\n_________________________________\nRESLINE DORCENT\nLA EMPRESA',
      ].join('\n\n'),
    },
    {
      ...base,
      id: 'seed-carta-laboral',
      name: 'Carta de Trabajo / Constancia Laboral',
      description: 'Constancia de labores (a quien pueda interesar) para bancos, embajadas o visas.',
      title: 'A QUIEN PUEDA INTERESAR',
      body: [
        'Distinguidos señores:',
        'El motivo de la presente es confirmar que {{trato}} {{nombre}}, portador(a) de la cédula de identidad y electoral no. {{cedula}}, es empleado(a) de nuestra empresa Spectra Healthcare & Management, SRL, quien se desempeña como {{cargo}}, desde el {{fecha_ingreso}} devengando un salario por hora / mensual de {{salario_letras}} (RD${{salario_hora}}*) unos (RD${{salario_mensual}}* al mes), entre otros beneficios correspondientes a la posición.',
        'La misma labora 40 horas a la semana.',
        'Esta certificación se emite a solicitud de la parte interesada.',
        'Dado en Santiago de los Caballeros {{fecha_legal}}.',
        'Atentamente,',
        '\n\n______________________\nLaura Amelia Lara\nHuman Resources Manager\n\nhr@spectrahealthcare.net   (829) 332-6322\nAv. Juan Pablo Duarte Esq. Entrada Cerros del Castillo\nSantiago De Los Caballeros 51000',
      ].join('\n\n'),
    },
    {
      ...base,
      id: 'seed-cuenta-nomina',
      name: 'Solicitud de Apertura de Cuenta Nómina',
      description: 'Carta al banco para abrir la cuenta nómina de un empleado.',
      title: '',
      body: [
        'Santiago de los Caballeros, R. D.\n{{fecha_hoy}}',
        'Señores:\nBanco Popular Dominicano.\nSantiago\nCiudad.',
        'Distinguidos señores:',
        'Por este medio, de la presente, quien suscribe Laura Amelia Lara P., en representación de SPECTRA HEALTHCARE & MANAGEMENT SRL. Cuenta Empresarial No. 818717779: solicitamos la apertura de cuenta nómina para {{nombre}}, cédula n.º {{cedula}}.',
        'Gracias Anticipadas,',
        'Atentamente,',
        '\n\n______________________________\nHuman Resources Manager\n\nAv. Juan Pablo Duarte Esq. Entrada Cerros del Castillo\nSantiago De Los Caballeros 51000\nhr@spectramanagement.net\nCell. 829-332-6322.',
      ].join('\n\n'),
    },
    {
      ...base,
      id: 'seed-nda',
      name: 'Acuerdo de Confidencialidad',
      description: 'Acuerdo de confidencialidad y obligaciones de no hacer (NDA).',
      title: 'ACUERDO DE CONFIDENCIALIDAD',
      body: [
        'ENTRE: De una parte la sociedad SPECTRA HEALTHCARE MANAGEMENT S.R.L., debidamente organizada y existente de conformidad con las leyes de la República Dominicana, con su domicilio social ubicado en la Avenida Juan Pablo Duarte, esquina Entrada Cerros del Castillo, de esta ciudad de Santiago de los Caballeros, República Dominicana, con Registro Nacional de Contribuyentes (RNC) No. 1-32-08245-1 y Registro Nacional Laboral No. 132082451-0001, debidamente representada, para los fines del presente acto, por su Gerente General, señora Resline Dorcent, de nacionalidad Haitiana, mayor de edad, titular del pasaporte No. GV4615595, domiciliada y residente en esta ciudad de Santiago de los Caballeros, República Dominicana; sociedad que en lo adelante se denominará por su nombre completo o como "LA EMPLEADORA"; y de la otra parte, {{trato}} {{nombre}}, de nacionalidad Dominicana, mayor de edad, portador(a) de la cédula de identidad y electoral No. {{cedula}}, y domiciliado(a) en {{direccion}}, República Dominicana; quien en lo adelante se denominará por sus propios nombre y apellidos o como "EL (LA) TRABAJADOR(A)". En conjunto, "LA EMPLEADORA" y "EL (LA) TRABAJADOR(A)" se denominarán "LAS PARTES".',
        'POR CUANTO: EL(LA) TRABAJADOR(A) labora para la empresa SPECTRA HEALTHCARE MANAGEMENT S.R.L., desempeñando la función de {{cargo}}, mediante contrato de trabajo.',
        'POR CUANTO: EL(LA) TRABAJADOR(A), en su condición de trabajador(a), ha tenido y tendrá acceso a una amplia información relacionada con las operaciones de LA EMPLEADORA, por lo que SPECTRA HEALTHCARE MANAGEMENT S.R.L. desea asegurarse de que EL(LA) TRABAJADOR(A), posteriormente a la terminación de su contrato de trabajo, no divulgará los conocimientos técnicos, ni ninguna información confidencial de LA EMPLEADORA o sus clientes, adquirida durante su permanencia en la misma, ya sea frente a sus clientes, empleados, ni ninguna otra persona.',
        'POR CUANTO: EL(LA) TRABAJADOR(A) desea abstenerse de divulgar información de SPECTRA HEALTHCARE MANAGEMENT S.R.L.',
        'POR TANTO y en el entendido de que el anterior preámbulo forma parte integral del presente contrato, las partes libre y voluntariamente, HAN CONVENIDO Y PACTADO LO SIGUIENTE:',
        'ARTÍCULO PRIMERO (1): ACUERDO DE CONFIDENCIALIDAD.\nEL(LA) TRABAJADOR(A) por medio del presente contrato, se compromete a guardar rigurosamente los secretos técnicos y comerciales de SPECTRA HEALTHCARE MANAGEMENT S.R.L. o cualquier otra compañía afiliada o subsidiaria a ellas, de las cuales haya podido tener conocimiento y de las informaciones que en razón de sus funciones haya conocido por cualquier medio, ya sea en la República Dominicana como en el extranjero.',
        'Del mismo modo, EL(LA) TRABAJADOR(A) se compromete a no divulgar o utilizar, a partir de la terminación de su contrato de trabajo en esta misma fecha, ninguna información confidencial relativa a las operaciones de SPECTRA HEALTHCARE MANAGEMENT S.R.L. o cualquier otra compañía subsidiaria o afiliada a ella, que haya sido confiada a dicho trabajador(a) por parte de LA EMPLEADORA o de la cual ha obtenido conocimiento durante el transcurso de su empleo.',
        'PÁRRAFO I: Por "Información Confidencial" se entiende que es información técnica o de negocios que no está generalmente disponible, o bien informaciones a las cuales se ha tenido acceso en razón de las funciones que desempeñaba y que de ser divulgadas perjudicarían SPECTRA HEALTHCARE MANAGEMENT S.R.L. o cualquier empresa subsidiaria o afiliada a las mismas en el país y/o en el extranjero.',
        'PÁRRAFO II: EL(LA) TRABAJADOR(A) reconoce y admite que toda información, fórmula, proceso, método, experticio, diseño, aparato o equipo, costos, información personal y confidencial de los clientes y/o afiliados, a que tuviere acceso EL(LA) TRABAJADOR(A) en razón de sus labores, es y constituye información privilegiada y confidencial de la propiedad exclusiva de LA EMPRESA, por lo que EL(LA) TRABAJADOR(A) se compromete a no utilizar a fines distintos para los cuales ha sido proporcionada y a no revelar o permitir que sea revelado, a ningún tercero, a excepción de aquellos empleados o gerentes de LA EMPRESA autorizados para ello, durante la vigencia de su empleo y aún posterior a la conclusión de este contrato, ninguna de las informaciones antes descritas. La violación de la presente disposición conllevará la inmediata terminación del presente contrato, con responsabilidad para EL(LA) TRABAJADOR(A), sin desmedro de la responsabilidad civil o penal en que pudiere incurrir EL(LA) TRABAJADOR(A) posteriormente a la terminación del mismo.',
        'PÁRRAFO III: EL(LA) TRABAJADOR(A) declara y reconoce que a la terminación de su contrato de trabajo, entregará a SPECTRA HEALTHCARE MANAGEMENT S.R.L., todo material escrito, documentos, instrumentos y otros objetos tangibles, que sean de su prioridad, incluyendo copias de documentos preparadas o compiladas por EL(LA) TRABAJADOR(A) o que hayan sido puestas a su disposición durante el transcurso del empleo.',
        'ARTÍCULO DOS (2): OBLIGACIONES DE NO HACER.\nEL(LA) TRABAJADOR(A) se compromete a abstenerse de realizar las siguientes acciones:\na) Interferir en las relaciones de SPECTRA HEALTHCARE MANAGEMENT S.R.L. con cualquier persona o entidad, ya sea, de manera directa o indirecta, ni se comunicará con los clientes o sus empleados sobre ningún tema que no sea relacionado con el trabajo;\nb) Inducir a cualquier trabajador de SPECTRA HEALTHCARE MANAGEMENT S.R.L., ya sea, directa o indirectamente, a terminar su contrato de trabajo o realizar actividades en contra de LA EMPLEADORA;\nc) Realizar comentarios desfavorables en contra de SPECTRA HEALTHCARE MANAGEMENT S.R.L. o cualquier otra empresa subsidiaria o afiliada a las mismas, tendentes a perjudicar en cualquier forma la imagen de la empresa o su estatus en el país; y\nd) En general, realizar cualquier tipo de actividad que pueda lesionar los intereses de SPECTRA HEALTHCARE MANAGEMENT S.R.L. o cualquiera de sus empresas afiliadas o subsidiarias.',
        'ARTÍCULO TERCERO (3): INDEMNIZACIÓN.\nLas partes declaran y reconocen que el incumplimiento de EL(LA) TRABAJADOR(A) con una de cualquiera de las obligaciones asumidas en el presente contrato, le hará pasible de una penalidad de CINCUENTA MIL DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (US$50,000.00), en beneficio de SPECTRA HEALTHCARE MANAGEMENT S.R.L. sin perjuicio de las acciones penales que puedan interponerse en su contra.',
        'ARTÍCULO CUARTO (4º): ELECCIÓN DE DOMICILIO.\nPara los fines y consecuencias legales del presente contrato, las partes eligen formal domicilio en sus respectivos domicilios anteriormente indicados.',
        'PÁRRAFO: Las partes acuerdan que en caso de que una de ellas cambie el domicilio de elección antes indicado, no le será oponible a la otra, hasta que le sea oportunamente comunicado mediante acto de alguacil.',
        'HECHO Y FIRMADO en dos (2) originales. En la ciudad de Santiago, República Dominicana, {{fecha_legal}}.',
        '\n\n_________________________________\nEn representación de la sociedad\nSPECTRA HEALTHCARE MANAGEMENT S.R.L.\nRESLINE DORCENT\n\n\n_________________________________\n{{nombre}}\nEL (LA) TRABAJADOR(A)',
      ].join('\n\n'),
    },
    {
      ...base,
      id: 'seed-amonestacion',
      name: 'Carta de Amonestación',
      description: 'Amonestación escrita por incumplimiento (acción de RR.HH.).',
      title: 'CARTA DE AMONESTACIÓN',
      body: [
        'Santiago de los Caballeros, {{fecha_hoy}}',
        '{{trato}} {{nombre}}\nCargo: {{cargo}}\nDepartamento: {{departamento}}',
        'Estimado(a) {{primer_nombre}}:',
        'Por medio de la presente, Spectra Healthcare & Management, SRL le notifica formalmente una amonestación escrita en relación con el siguiente hecho: ____________________________________ [describir el hecho o falta].',
        'Le recordamos la importancia de cumplir con las políticas internas y con sus responsabilidades laborales. La reincidencia podrá dar lugar a sanciones adicionales conforme al Código de Trabajo y al reglamento interno.',
        'Esta comunicación forma parte de su expediente laboral.',
        'Atentamente,',
        '\n\n______________________\nLaura Amelia Lara\nHuman Resources Manager',
      ].join('\n\n'),
    },
  ]
}
