// Ayuda para las pruebas que venían de scripts/probar-*.js: cada llamada registra un test.
// Igual que en los scripts, se compara la forma JSON de los valores (Infinity y NaN pasan a
// null, las propiedades undefined desaparecen) y se toma la foto en el momento de la llamada,
// aunque el objeto cambie después.
import { it, expect } from "vitest";

const foto = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function igual(real, esperado, nombre) {
  const a = foto(real);
  const b = foto(esperado);
  it(nombre, () => {
    expect(a).toEqual(b);
  });
}
