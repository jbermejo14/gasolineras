import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  camposPendientes,
  ficheroTitular,
  getTitular,
  valorOPendiente,
  type Titular
} from '../src/lib/legal.ts';

const TITULAR_REAL = join('config', 'titular.json');
const TITULAR_EJEMPLO = join('config', 'titular.example.json');

const PLANTILLA: Titular = {
  tipo: 'persona-fisica',
  nombre: '',
  nif: '',
  domicilio: '',
  email: '',
  registroMercantil: ''
};

let directorio = '';

function escribir(fichero: string, contenido: unknown): void {
  writeFileSync(join(directorio, fichero), JSON.stringify(contenido));
}

function titularDePrueba(sobrescribe: Partial<Titular>): Titular {
  return { ...PLANTILLA, ...sobrescribe };
}

beforeEach(() => {
  directorio = mkdtempSync(join(tmpdir(), 'legal-test-'));
  mkdirSync(join(directorio, 'config'));
});

afterEach(() => {
  rmSync(directorio, { recursive: true, force: true });
});

describe('getTitular y ficheroTitular', () => {
  it('usa la plantilla si no existe titular.json', () => {
    escribir(TITULAR_EJEMPLO, PLANTILLA);
    assert.equal(ficheroTitular(directorio), TITULAR_EJEMPLO);
    assert.deepEqual(getTitular(directorio), PLANTILLA);
  });

  it('lee el real si existe', () => {
    escribir(TITULAR_EJEMPLO, PLANTILLA);
    escribir(TITULAR_REAL, { ...PLANTILLA, tipo: 'empresa', nombre: 'Empresa de prueba' });
    assert.equal(ficheroTitular(directorio), TITULAR_REAL);
    const titular = getTitular(directorio);
    assert.equal(titular.tipo, 'empresa');
    assert.equal(titular.nombre, 'Empresa de prueba');
  });

  it('falla con un tipo inválido indicando fichero y campo', () => {
    escribir(TITULAR_REAL, { ...PLANTILLA, tipo: 'otro' });
    assert.throws(() => getTitular(directorio), /titular\.json.*"tipo".*"otro"/);
  });

  it('falla si falta un campo', () => {
    const { email: _email, ...sinEmail } = PLANTILLA;
    escribir(TITULAR_REAL, sinEmail);
    assert.throws(() => getTitular(directorio), /titular\.json.*"email"/);
  });
});

describe('camposPendientes', () => {
  it('lista los obligatorios vacíos y no exige registroMercantil a persona física', () => {
    assert.deepEqual(camposPendientes(titularDePrueba({})), ['nombre', 'nif', 'domicilio', 'email']);
  });

  it('exige registroMercantil a empresa', () => {
    const titular = titularDePrueba({ tipo: 'empresa', nombre: 'A', nif: 'B', domicilio: 'C', email: 'D' });
    assert.deepEqual(camposPendientes(titular), ['registroMercantil']);
  });

  it('trata como vacío un valor de solo espacios', () => {
    const titular = titularDePrueba({ nombre: '   ', nif: 'B', domicilio: 'C', email: 'D' });
    assert.deepEqual(camposPendientes(titular), ['nombre']);
  });
});

describe('valorOPendiente', () => {
  it('devuelve el valor o el marcador', () => {
    const titular = titularDePrueba({ nombre: 'Ana' });
    assert.equal(valorOPendiente(titular, 'nombre'), 'Ana');
    assert.equal(valorOPendiente(titular, 'nif'), '[pendiente: nif]');
  });
});
