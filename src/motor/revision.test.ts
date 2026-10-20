import { describe, expect, it } from 'vitest';
import type { EntradasCotizacion } from './calculo';
import { crearRevision, type FuentesRevision } from './revision';

const entradas: EntradasCotizacion = {
  pujaUsd: '2200',
  modoFees: 'total_fees',
  feesUsd: '795',
  carroMasFeesUsd: null,
  feeTablaUsd: null,
  gruaUsd: '270',
  barcoUsd: '1020',
  papeleriaUsd: '15',
  tipoCambioHnlPorUsd: '27.0288',
  modoImpuestos: 'combinado',
  totalCombinadoHnl: '50297.89',
  impuestoHnl: null,
  gastosLocalesHnl: null,
  reparacionHnl: '20000',
  precioVentaHnl: '220000',
};

const fuentes: FuentesRevision = {
  perfilFeesClave: 'iaa_standard_volume',
  versionTablaFees: null,
  tarifaEmbarqueId: 'NA-2025-DELAWARE-SUV_CAMIONETA',
  gruaId: '12',
  tipoCambioFuente: 'manual',
};

describe('revisión congelada', () => {
  it('guarda importes como texto y el resultado ya calculado', () => {
    const r = crearRevision(entradas, fuentes, '2026-10-19T12:00:00Z');
    expect(r.entradas.pujaUsd).toBe('2200');
    expect(r.resultado.cashUsd).toBe('4300');
    expect(r.resultado.importadoHnl).toBe('166521.73');
    expect(r.resultado.utilidadHnl).toBe('33478.27');
    expect(r.resultado.feesFuente).toBe('manual');
  });

  it('es inmutable en todos sus niveles', () => {
    const r = crearRevision(entradas, fuentes, '2026-10-19T12:00:00Z');
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.resultado)).toBe(true);
    expect(Object.isFrozen(r.resultado.pendientes)).toBe(true);
    expect(() => {
      (r.resultado as { cashUsd: string | null }).cashUsd = '1';
    }).toThrow();
  });

  it('cambios posteriores a las entradas o a las fuentes no alteran la revisión', () => {
    const mutable = { ...entradas };
    const fuentesMutables = { ...fuentes };
    const r = crearRevision(mutable, fuentesMutables, '2026-10-19T12:00:00Z');
    mutable.pujaUsd = '9999';
    fuentesMutables.tarifaEmbarqueId = 'OTRA';
    expect(r.entradas.pujaUsd).toBe('2200');
    expect(r.fuentes.tarifaEmbarqueId).toBe('NA-2025-DELAWARE-SUV_CAMIONETA');
  });

  it('guarda la versión de la tabla de fees usada', () => {
    const r = crearRevision({ ...entradas, modoFees: 'tabla', feesUsd: null, feeTablaUsd: '150' }, { ...fuentes, versionTablaFees: 'iaa-2026-10' }, 'x');
    expect(r.fuentes.versionTablaFees).toBe('iaa-2026-10');
    expect(r.resultado.feesFuente).toBe('tabla');
  });
});
