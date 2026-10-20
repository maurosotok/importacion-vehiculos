import Decimal from 'decimal.js';
import { valorDecimal, type Valor } from './calculo';

export type ConvencionLimite = 'desde_incluido_hasta_excluido' | 'desde_excluido_hasta_incluido';

export type TramoFee = {
  desde: Valor;
  hasta: Valor;
  tipo: 'fijo' | 'porcentaje';
  valor: Valor;
};

export type EstadoFee = 'verificada' | 'captura_manual' | 'caso_real';

export type CargoFee = {
  codigo: string;
  etiqueta: string;
  monto: Valor;
  modalidad: string | null;
  desde?: Valor;
  hasta?: Valor;
  estado?: EstadoFee;
};

export type VersionFees = {
  perfilId: string;
  version: string;
  fuente: string | null;
  fechaFuente: string | null;
  estado: 'verificada' | 'captura_manual' | 'pendiente';
  convencionLimite: ConvencionLimite;
  modalidades: string[];
  tramos: TramoFee[];
  cargos: CargoFee[];
};

export type LineaFee = { concepto: string; monto: Decimal; estado?: EstadoFee };

export type ResultadoTablaFees =
  | { ok: true; total: Decimal; lineas: LineaFee[]; tramoIndice: number; version: string }
  | {
      ok: false;
      motivo:
        | 'sin_tabla'
        | 'sin_tramo'
        | 'puja_invalida'
        | 'version_invalida'
        | 'cargo_sin_cobertura'
        | 'modalidad_no_documentada';
    };

type Limite = Decimal | null | 'invalido';

function leerLimite(valor: Valor): Limite {
  if (valor === null || valor === undefined || valor === '') return null;
  return valorDecimal(valor) ?? 'invalido';
}

export function validarVersionFees(version: VersionFees): string[] {
  const errores: string[] = [];
  if (version.estado !== 'pendiente' && version.tramos.length === 0) errores.push('sin tramos');
  if (version.estado === 'verificada' && (!version.fuente || !version.fechaFuente)) {
    errores.push('verificada sin fuente o fecha');
  }
  version.cargos.forEach((cargo) => {
    const desde = leerLimite(cargo.desde ?? null);
    const hasta = leerLimite(cargo.hasta ?? null);
    const invertido = desde instanceof Decimal && hasta instanceof Decimal && desde.gte(hasta);
    if (desde === 'invalido' || hasta === 'invalido' || invertido) errores.push(`cargo ${cargo.codigo}: rango inválido`);
  });
  if (version.tramos.length === 0) return errores;

  const tramos = version.tramos.map((t) => ({
    desde: leerLimite(t.desde),
    hasta: leerLimite(t.hasta),
    valor: valorDecimal(t.valor),
    tipo: t.tipo,
  }));

  tramos.forEach((t, i) => {
    const n = String(i + 1);
    if (t.desde === 'invalido' || t.hasta === 'invalido') errores.push(`tramo ${n}: límite inválido`);
    if (t.valor === null || t.valor.isNegative()) errores.push(`tramo ${n}: valor inválido`);
    if (t.tipo === 'porcentaje' && t.valor !== null && t.valor.gt(100)) {
      errores.push(`tramo ${n}: porcentaje mayor que 100`);
    }
    if (t.desde instanceof Decimal && t.hasta instanceof Decimal && t.desde.gte(t.hasta)) {
      errores.push(`tramo ${n}: desde debe ser menor que hasta`);
    }
  });

  const primero = tramos[0];
  const ultimo = tramos[tramos.length - 1];
  const primeroSinInicio = primero?.desde === null || (primero?.desde instanceof Decimal && primero.desde.isZero());
  if (primero && !primeroSinInicio) errores.push('el primer tramo debe empezar sin límite inferior');
  if (ultimo && ultimo.hasta !== null) errores.push('el último tramo debe quedar abierto');

  for (let i = 1; i < tramos.length; i++) {
    const anterior = tramos[i - 1];
    const actual = tramos[i];
    if (!anterior || !actual) continue;
    const frontera = anterior.hasta;
    const inicio = actual.desde;
    if (!(frontera instanceof Decimal) || !(inicio instanceof Decimal) || !frontera.eq(inicio)) {
      errores.push(`tramos ${String(i)} y ${String(i + 1)}: no son contiguos`);
    }
  }
  return errores;
}

function dentroDeRango(
  puja: Decimal,
  limiteDesde: Valor,
  limiteHasta: Valor,
  convencion: ConvencionLimite,
): boolean {
  const desde = leerLimite(limiteDesde);
  const hasta = leerLimite(limiteHasta);
  if (desde === 'invalido' || hasta === 'invalido') return false;
  if (convencion === 'desde_incluido_hasta_excluido') {
    return (desde === null || puja.gte(desde)) && (hasta === null || puja.lt(hasta));
  }
  return (desde === null || puja.gt(desde)) && (hasta === null || puja.lte(hasta));
}

function tramoContiene(puja: Decimal, tramo: TramoFee, convencion: ConvencionLimite): boolean {
  const desde = leerLimite(tramo.desde);
  const hasta = leerLimite(tramo.hasta);
  if (desde === 'invalido' || hasta === 'invalido') return false;
  if (convencion === 'desde_incluido_hasta_excluido') {
    return (desde === null || puja.gte(desde)) && (hasta === null || puja.lt(hasta));
  }
  return (desde === null || puja.gt(desde)) && (hasta === null || puja.lte(hasta));
}

export function calcularTablaFees(
  puja: Valor,
  version: VersionFees | null,
  modalidad: string | null,
): ResultadoTablaFees {
  if (version === null || version.tramos.length === 0) return { ok: false, motivo: 'sin_tabla' };
  if (validarVersionFees(version).length > 0) return { ok: false, motivo: 'version_invalida' };
  const pujaDecimal = valorDecimal(puja);
  if (pujaDecimal === null || pujaDecimal.isNegative()) return { ok: false, motivo: 'puja_invalida' };

  const indice = version.tramos.findIndex((t) => tramoContiene(pujaDecimal, t, version.convencionLimite));
  const tramo = version.tramos[indice];
  if (indice < 0 || !tramo) return { ok: false, motivo: 'sin_tramo' };

  const valor = valorDecimal(tramo.valor);
  if (valor === null) return { ok: false, motivo: 'version_invalida' };
  const base = tramo.tipo === 'fijo' ? valor : pujaDecimal.times(valor).div(100);

  if (version.modalidades.length > 0 && (modalidad === null || !version.modalidades.includes(modalidad))) {
    return { ok: false, motivo: 'modalidad_no_documentada' };
  }

  const lineas: LineaFee[] = [{ concepto: 'Buyer fee base', monto: base }];
  const codigos = [...new Set(version.cargos.map((c) => c.codigo))];
  for (const codigo of codigos) {
    const aplicables = version.cargos.filter(
      (c) => c.codigo === codigo && (c.modalidad === null || c.modalidad === modalidad),
    );
    const vigentes = aplicables.filter((c) =>
      dentroDeRango(pujaDecimal, c.desde ?? null, c.hasta ?? null, version.convencionLimite),
    );
    if (vigentes.length === 0) {
      if (aplicables.length > 0) return { ok: false, motivo: 'cargo_sin_cobertura' };
      continue;
    }
    const [cargo, ...otros] = vigentes;
    if (!cargo || otros.length > 0) return { ok: false, motivo: 'version_invalida' };
    const monto = valorDecimal(cargo.monto);
    if (monto === null || monto.isNegative()) return { ok: false, motivo: 'version_invalida' };
    lineas.push({ concepto: cargo.etiqueta, monto, estado: cargo.estado });
  }

  const total = lineas.reduce((suma, linea) => suma.plus(linea.monto), new Decimal(0));
  return { ok: true, total, lineas, tramoIndice: indice, version: version.version };
}
