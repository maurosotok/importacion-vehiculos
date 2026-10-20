export type CeldaCsv = string | number | null;

const BOM = '﻿';

export function escaparCelda(valor: CeldaCsv): string {
  if (valor === null) return '';
  if (typeof valor === 'number') return String(valor);
  const texto = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCsv(filas: CeldaCsv[][]): string {
  const lineas = filas.map((fila) => fila.map(escaparCelda).join(','));
  return `${BOM}${lineas.join('\r\n')}\r\n`;
}
