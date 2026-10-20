import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CARPETA_MIGRACIONES = path.join(RAIZ, 'supabase', 'migrations');
const MARCA_APROBADA = '-- migracion-destructiva-aprobada:';
const PATRON_NOMBRE = /^\d{14}_[a-z0-9_]+\.sql$/;
const PATRON_DESTRUCTIVO = /\b(drop\s+(table|column|schema|type|function|index|policy|trigger)|truncate|delete\s+from|alter\s+(table|type)\s+\S+\s+drop\s+column|alter\s+table\s+\S+\s+alter\s+column\s+\S+\s+type)\b/i;
const PATRON_SECRETO = /service_role|sb_secret_|sbp_[a-z0-9]{20,}/i;

export async function listarMigraciones() {
  const nombres = (await readdir(CARPETA_MIGRACIONES)).filter((n) => n.endsWith('.sql')).sort();
  const problemas = [];
  for (const nombre of nombres) {
    if (!PATRON_NOMBRE.test(nombre)) problemas.push(`${nombre}: nombre no válido (use AAAAMMDDHHMMSS_descripcion.sql)`);
    const sql = await readFile(path.join(CARPETA_MIGRACIONES, nombre), 'utf8');
    const destructivo = sql.match(PATRON_DESTRUCTIVO);
    if (destructivo && !sql.includes(MARCA_APROBADA)) {
      problemas.push(`${nombre}: sentencia destructiva "${destructivo[0]}" sin marca ${MARCA_APROBADA}`);
    }
    if (PATRON_SECRETO.test(sql)) problemas.push(`${nombre}: contiene un patrón de clave secreta`);
  }
  const marcas = nombres.map((n) => n.slice(0, 14));
  if (new Set(marcas).size !== marcas.length) problemas.push('Hay marcas de tiempo de migración duplicadas');
  return { nombres, problemas };
}

async function principal() {
  const { nombres, problemas } = await listarMigraciones();
  if (problemas.length > 0) {
    for (const p of problemas) console.error(p);
    process.exitCode = 1;
    return;
  }
  console.log(`Migraciones válidas: ${nombres.length}`);
  for (const n of nombres) console.log(`  ${n}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal();
}
