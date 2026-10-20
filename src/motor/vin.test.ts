import { describe, expect, it } from 'vitest';
import {
  ControladorVin,
  estadoVin,
  interpretarRespuestaVpic,
  normalizarVin,
  vinsRepetidos,
  type FetchVin,
} from './vin';

const VIN = '5J6RE4H39BL018538';

const respuesta = (datos: Record<string, string>) => ({
  ok: true,
  json: () => Promise.resolve({ Results: [datos] }),
});

describe('estado del VIN', () => {
  it('ausente, incompleto y completo no bloquean la cotización', () => {
    expect(estadoVin('')).toBe('ausente');
    expect(estadoVin(null)).toBe('ausente');
    expect(estadoVin('5J6RE4H39')).toBe('incompleto');
    expect(estadoVin(VIN)).toBe('completo');
  });

  it('normaliza espacios y mayúsculas', () => {
    expect(normalizarVin(' 5j6 re4h39bl018538 ')).toBe(VIN);
    expect(estadoVin('5j6 re4h39bl018538')).toBe('completo');
  });

  it('marca como formato inválido letras I, O o Q', () => {
    expect(estadoVin('5J6RE4H39BL01853I')).toBe('formato_invalido');
    expect(estadoVin('5J6RE4H39BL0185O8')).toBe('formato_invalido');
  });
});

describe('interpretación de la respuesta vPIC', () => {
  it('toma marca, modelo y año del primer resultado', () => {
    expect(interpretarRespuestaVpic({ Results: [{ Make: 'HONDA', Model: 'CR-V', ModelYear: '2011' }] })).toEqual({
      marca: 'HONDA',
      modelo: 'CR-V',
      anio: 2011,
    });
  });

  it('campos vacíos quedan nulos y una respuesta sin datos devuelve null', () => {
    expect(interpretarRespuestaVpic({ Results: [{ Make: '', Model: '', ModelYear: '' }] })).toBeNull();
    expect(interpretarRespuestaVpic({ Results: [{ Make: 'HONDA', Model: ' ', ModelYear: 'x' }] })).toEqual({
      marca: 'HONDA',
      modelo: null,
      anio: null,
    });
  });

  it('respuestas malformadas no lanzan', () => {
    expect(interpretarRespuestaVpic(null)).toBeNull();
    expect(interpretarRespuestaVpic({ Results: 'nope' })).toBeNull();
  });
});

describe('vins repetidos', () => {
  it('agrupa cotizaciones o vehículos con el mismo VIN normalizado', () => {
    const r = vinsRepetidos([
      { id: 'a', vin: VIN },
      { id: 'b', vin: ` ${VIN.toLowerCase()} ` },
      { id: 'c', vin: null },
      { id: 'd', vin: 'OTRO' },
    ]);
    expect([...r.entries()]).toEqual([[VIN, ['a', 'b']]]);
  });
});

describe('ControladorVin', () => {
  it('no consulta un VIN incompleto y no lanza', async () => {
    const fetchFn: FetchVin = () => Promise.reject(new Error('no debe llamarse'));
    const controlador = new ControladorVin(fetchFn);
    await expect(controlador.consultar('123')).resolves.toEqual({ estado: 'sin_datos', vin: '123' });
  });

  it('devuelve datos y reutiliza el caché', async () => {
    let llamadas = 0;
    const fetchFn: FetchVin = () => {
      llamadas++;
      return Promise.resolve(respuesta({ Make: 'HONDA', Model: 'CR-V', ModelYear: '2011' }));
    };
    const controlador = new ControladorVin(fetchFn);
    await controlador.consultar(VIN);
    const segundo = await controlador.consultar(VIN);
    expect(segundo).toMatchObject({ estado: 'datos', datos: { marca: 'HONDA' } });
    expect(llamadas).toBe(1);
  });

  it('un error de red queda como error y no lanza', async () => {
    const controlador = new ControladorVin(() => Promise.reject(new Error('red')));
    await expect(controlador.consultar(VIN)).resolves.toEqual({ estado: 'error', vin: VIN });
  });

  it('descarta una respuesta vieja si llegó otra consulta después', async () => {
    let liberar: () => void = () => undefined;
    const pendiente = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const fetchFn: FetchVin = async (url) => {
      if (url.includes(VIN)) {
        await pendiente;
        return respuesta({ Make: 'HONDA', Model: 'CR-V', ModelYear: '2011' });
      }
      return respuesta({ Make: 'TOYOTA', Model: 'Camry', ModelYear: '2015' });
    };
    const controlador = new ControladorVin(fetchFn);
    const vieja = controlador.consultar(VIN);
    const nueva = controlador.consultar('1HGCM82633A004352');
    liberar();
    await expect(vieja).resolves.toEqual({ estado: 'descartado' });
    await expect(nueva).resolves.toMatchObject({ estado: 'datos', datos: { marca: 'TOYOTA' } });
  });
});
