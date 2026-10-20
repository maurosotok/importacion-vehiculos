import Decimal from 'decimal.js';
import { valorDecimal, type Valor } from './calculo';

export type ConvencionLimite = 'desde_incluido_hasta_excluido' | 'desde_excluido_hasta_incluido';

export type TramoFee = {
  desde: Valor;
  hasta: Valor;
  tipo: 'fijo' | 'porcentaje';
  valor: Valor;
};

export type CargoFee = {
  codigo: string;
  etiqueta: string;
  monto: Valor;
  modalidad: string | null;
};

export type VersionFees = {
  perfilId: string;
  version: string;
  fuente: string | null;
  fechaFuente: string | null;
  estado: 'verificada' | 'captura_manual' | 'pendiente';
  convencionLimite: ConvencionLimite;
  tramos: TramoFee[];
  cargos: CargoFee[];
};

export type LineaFee = { concepto: string; monto: Decimal };

export type ResultadoTablaFees =
  | { ok: true; total: Decimal; lineas: LineaFee[]; tramoIndice: number; version: string }
  | { ok: false; motivo: 'sin_tabla' | 'sin_tramo' | 'puja_invalida' | 'version_invalida' };

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
  if (primero && primero.desde !== null) errores.push('el primer tramo debe empezar sin límite inferior');
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

  const lineas: LineaFee[] = [{ concepto: 'Buyer fee base', monto: base }];
  for (const cargo of version.cargos) {
    if (cargo.modalidad !== null && cargo.modalidad !== modalidad) continue;
    const monto = valorDecimal(cargo.monto);
    if (monto === null || monto.isNegative()) return { ok: false, motivo: 'version_invalida' };
    lineas.push({ concepto: cargo.etiqueta, monto });
  }

  const total = lineas.reduce((suma, linea) => suma.plus(linea.monto), new Decimal(0));
  return { ok: true, total, lineas, tramoIndice: indice, version: version.version };
}
